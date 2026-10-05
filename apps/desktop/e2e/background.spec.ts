import { copyFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, test } from './fixtures/app';

const readVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

test('paints a background color and image, served only for the configured file', async ({
  window,
  configDir,
}) => {
  await window.ready();
  const image = join(configDir, 'wall paper.png');
  await copyFile(resolve(import.meta.dirname, '../build/icon.png'), image);
  await writeFile(
    join(configDir, 'config.json'),
    JSON.stringify({
      backgroundColor: '#336699',
      backgroundImage: image,
      backgroundImageFit: 'fill',
      backgroundImageOpacity: 0.5,
      backgroundBlur: true,
    }),
  );
  const { page } = window;
  await expect.poll(() => page.evaluate(readVar, '--background-color')).toBe('#336699');
  await expect.poll(() => page.evaluate(readVar, '--background-image-size')).toBe('100% 100%');
  expect(await page.evaluate(readVar, '--background-image-opacity')).toBe('0.5');

  const url = await page.evaluate(readVar, '--background-image');
  expect(url).toMatch(/^url\("glaceon-bg:\/\/image\/\?v=/);
  // Loaded as an image, the way CSS uses it (the CSP allows nothing else for this scheme).
  const served = (path: string): Promise<number> =>
    page.evaluate(
      (target) =>
        new Promise<number>((done) => {
          const image = new Image();
          image.onload = () => {
            done(image.naturalWidth);
          };
          image.onerror = () => {
            done(0);
          };
          image.src = target;
        }),
      path,
    );
  expect(await served(url.slice(5, -2))).toBe(1024);
  // Whatever the path asks for, only the configured image is ever served.
  expect(await served('glaceon-bg://image/etc/passwd?x=1')).toBe(1024);

  // A path that is not an image serves nothing.
  await writeFile(
    join(configDir, 'config.json'),
    JSON.stringify({ backgroundImage: '/etc/passwd' }),
  );
  await expect.poll(() => served(`${url.slice(5, -2)}&t=${String(Date.now())}`)).toBe(0);
  await expect.poll(() => page.evaluate(readVar, '--background-color')).toBe('transparent');
});
