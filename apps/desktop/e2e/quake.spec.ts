import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ElectronApplication } from '@playwright/test';
import { expect, newWindowFrom, test } from './fixtures/app';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Test hook main installs under e2e (shortcuts never reach the real system there). */
interface QuakeHook {
  __glaceonQuake: {
    press(): void;
    status(): { registered: boolean; error?: string };
    visible(): boolean;
    bounds(): Rect | undefined;
    workArea(): Rect;
  };
}

const quake = {
  press: (app: ElectronApplication) =>
    app.evaluate(() => {
      (globalThis as unknown as QuakeHook).__glaceonQuake.press();
    }),
  visible: (app: ElectronApplication) =>
    app.evaluate(() => (globalThis as unknown as QuakeHook).__glaceonQuake.visible()),
  geometry: (app: ElectronApplication) =>
    app.evaluate(() => {
      const hook = (globalThis as unknown as QuakeHook).__glaceonQuake;
      return { bounds: hook.bounds(), workArea: hook.workArea() };
    }),
};

test('the quake shortcut drops a terminal down and hides it again, keeping its shell', async ({
  app,
  window,
}) => {
  const drop = await newWindowFrom(app, () => quake.press(app));
  await expect.poll(() => quake.visible(app)).toBe(true);
  await expect(drop.page.locator('.app--quake')).toHaveCount(1);
  const { bounds, workArea } = await quake.geometry(app);
  expect(bounds).toMatchObject({ x: workArea.x, y: workArea.y, width: workArea.width });
  expect(bounds?.height).toBeCloseTo(workArea.height * 0.45, -1);

  const pid = await drop.sessionPid();
  await drop.type('echo quake-marker\n');
  await expect.poll(() => drop.terminalText()).toMatch(/^quake-marker$/m);

  await quake.press(app);
  await expect.poll(() => quake.visible(app)).toBe(false);
  await quake.press(app);
  await expect.poll(() => quake.visible(app)).toBe(true);
  expect(await drop.sessionPid()).toBe(pid);
  expect(await drop.terminalText()).toMatch(/^quake-marker$/m);
  expect(app.windows()).toHaveLength(2);

  // The quake window is not offered as a "Move to Window" target.
  await window.page.getByTestId('tab').first().click({ button: 'right' });
  await expect(window.page.getByTestId('context-menu')).not.toContainText('Move to Window');
});

test.describe('quake shortcut problems', () => {
  test.use({ initialSettings: '{ "quakeShortcut": "hyper+q" }' });

  test('are shown in settings', async ({ window, configDir }) => {
    await window.press('Meta+Comma');
    const error = window.page.getByTestId('quake-error');
    await expect(error).toContainText('not a valid shortcut');
    await writeFile(join(configDir, 'config.json'), '{ "quakeShortcut": "ctrl+alt+`" }');
    await expect(error).toHaveCount(0);
  });
});
