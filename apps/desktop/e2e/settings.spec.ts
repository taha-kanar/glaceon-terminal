import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from './fixtures/app';

test('creates a commented settings file on first launch', async ({ window, configDir }) => {
  await window.ready();
  const text = await readFile(join(configDir, 'config.json'), 'utf8');
  expect(text).toContain('// Glaceon Terminal settings');
});

test.describe('hot reload', () => {
  test.use({ initialSettings: '{ "fontSize": 14 }' });

  test('applies edits live and keeps the last good settings on errors', async ({
    window,
    configDir,
  }) => {
    const file = join(configDir, 'config.json');
    expect(await window.fontSize()).toBe(14);

    await writeFile(file, '// edited\n{ "fontSize": 18, "theme": "dracula" }\n');
    await expect.poll(() => window.fontSize()).toBe(18);
    await expect
      .poll(() =>
        window.page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
        ),
      )
      .toBe('#bd93f9');

    await writeFile(file, '{ "fontSize": 18, ');
    const banner = window.page.getByTestId('settings-problems');
    await expect(banner).toBeVisible();
    expect(await window.fontSize()).toBe(18);

    await writeFile(file, '{ "fontSize": 400 }');
    await expect(banner).toContainText('fontSize');

    await writeFile(file, '{ "fontSize": 12 }');
    await expect(banner).toHaveCount(0);
    await expect.poll(() => window.fontSize()).toBe(12);
  });

  test('remaps keybindings from the settings file', async ({ window, configDir }) => {
    await writeFile(
      join(configDir, 'config.json'),
      `{
        "fontSize": 15,
        "keybindings": [
          { "key": "", "command": "-pane.splitRight" },
          { "key": "cmd+e", "command": "pane.splitRight" }
        ]
      }`,
    );
    await expect.poll(() => window.fontSize()).toBe(15);

    await window.press('Meta+d');
    await window.page.waitForTimeout(300);
    expect((await window.workspace())[0]?.panes.length).toBe(1);
    await window.press('Meta+e');
    await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(2);
  });
});
