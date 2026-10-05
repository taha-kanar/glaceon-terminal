import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from './fixtures/app';

const panes = async (window: { workspace(): Promise<{ panes: readonly string[] }[]> }) =>
  (await window.workspace())[0]?.panes.length;

test('command palette finds and runs commands', async ({ window }) => {
  await window.press('Meta+Shift+p');
  const palette = window.page.getByTestId('palette');
  await expect(palette).toBeVisible();
  await window.type('split right');
  await expect(palette.getByRole('option').first()).toContainText('Split Right');
  await expect(palette.getByRole('option').first()).toContainText('⌘D');
  await window.press('Enter');
  await expect(palette).toHaveCount(0);
  await expect.poll(() => panes(window)).toBe(2);

  // While the palette is open, pane shortcuts are paused.
  await window.press('Meta+Shift+p');
  await window.press('Meta+w');
  await window.press('Escape');
  await expect(palette).toHaveCount(0);
  expect(await panes(window)).toBe(2);
});

test.describe('settings panel', () => {
  test.use({ initialSettings: '// my settings\n{\n  // big text\n  "fontSize": 14\n}\n' });

  test('writes changes to config.json, keeping comments', async ({ window, configDir }) => {
    await window.press('Meta+Comma');
    const panel = window.page.getByTestId('settings-panel');
    await expect(panel).toBeVisible();

    const fontSize = panel.locator('[name="fontSize"]');
    await fontSize.fill('17');
    await fontSize.press('Enter');
    await expect.poll(() => window.fontSize()).toBe(17);
    await panel.locator('[name="cursorBlink"]').click();

    await panel.getByRole('tab', { name: 'Themes' }).click();
    await panel.getByTestId('theme-gruvbox-dark').click();
    await expect
      .poll(() =>
        window.page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
        ),
      )
      .toBe('#d79921');

    const text = await readFile(join(configDir, 'config.json'), 'utf8');
    expect(text).toContain('// my settings');
    expect(text).toContain('// big text');
    expect(text).toMatch(/"fontSize": 17/);
    expect(text).toMatch(/"cursorBlink": false/);
    expect(text).toMatch(/"theme": "gruvbox-dark"/);
  });

  test('theme editor saves a custom theme', async ({ window, configDir }) => {
    await window.press('Meta+Shift+p');
    await window.type('edit themes');
    await window.press('Enter');
    const panel = window.page.getByTestId('settings-panel');
    await panel
      .getByTestId('theme-nord')
      .locator('..')
      .getByRole('button', { name: 'Customize' })
      .click();
    const editor = panel.getByTestId('theme-editor');
    await editor.locator('[name="accent"]').fill('#ff8800');
    await expect
      .poll(() =>
        window.page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
        ),
      )
      .toBe('#ff8800');
    await editor.getByRole('button', { name: 'Save theme' }).click();
    await expect(panel.getByTestId('theme-nord-copy')).toHaveAttribute('aria-checked', 'true');

    const text = await readFile(join(configDir, 'config.json'), 'utf8');
    expect(text).toMatch(/"theme": "nord-copy"/);
    expect(text).toMatch(/"accent": "#ff8800"/);
  });

  test('records a new shortcut', async ({ window }) => {
    await window.press('Meta+Comma');
    const panel = window.page.getByTestId('settings-panel');
    await panel.getByRole('tab', { name: 'Keybindings' }).click();
    const row = panel.getByTestId('keybinding-pane.splitDown');
    await row.locator('.keycap').click();
    await window.press('Meta+Alt+j');
    await expect(row.locator('.keycap')).toHaveText('⌥⌘J');
    await window.press('Escape');
    await expect(panel).toHaveCount(0);

    await window.press('Meta+Alt+j');
    await expect.poll(() => panes(window)).toBe(2);
  });
});

test('the title bar gear and the app menu open settings; Escape closes them', async ({
  app,
  window,
}) => {
  await window.ready();
  const panel = window.page.getByTestId('settings-panel');
  await window.page.getByTestId('settings-button').click();
  await expect(panel).toBeVisible();
  await window.press('Escape');
  await expect(panel).toHaveCount(0);

  // The menu leaves focus in the terminal; the panel must still hear Escape.
  await app.evaluate(({ Menu }) => {
    const appMenu = Menu.getApplicationMenu()?.items[0]?.submenu;
    appMenu?.items.find((item) => item.label === 'Settings…')?.click();
  });
  await expect(panel).toBeVisible();
  await window.press('Escape');
  await expect(panel).toHaveCount(0);
});
