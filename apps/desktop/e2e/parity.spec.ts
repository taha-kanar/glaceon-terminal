import { expect, test, type GlaceonWindow } from './fixtures/app';

interface ClipboardBridge {
  readonly glaceon: { readClipboard(): Promise<string>; writeClipboard(text: string): void };
}

const menuItem = (window: GlaceonWindow, name: string) =>
  window.page.getByRole('menu').getByRole('menuitem', { name, exact: true });

async function paneMenu(window: GlaceonWindow, item: string): Promise<void> {
  const pane = await window.activePane();
  await window.page.locator(`[data-pane="${String(pane)}"] .pane__terminal`).click({
    button: 'right',
  });
  await menuItem(window, item).click();
  await expect(window.page.getByRole('menu')).toHaveCount(0);
}

test('the terminal context menu copies, pastes, selects and splits', async ({ window }) => {
  await window.ready();
  await window.type('echo context-$((20+3))\n');
  await expect.poll(() => window.terminalText()).toMatch(/^context-23$/m);

  await paneMenu(window, 'Select All');
  await paneMenu(window, 'Copy');
  await expect
    .poll(() =>
      window.page.evaluate(() =>
        (globalThis.window as unknown as ClipboardBridge).glaceon.readClipboard(),
      ),
    )
    .toContain('context-23');

  await window.page.evaluate(() => {
    (globalThis.window as unknown as ClipboardBridge).glaceon.writeClipboard(
      'echo pasted-$((40+2))',
    );
  });
  await paneMenu(window, 'Paste');
  await window.press('Enter');
  await expect.poll(() => window.terminalText()).toMatch(/^pasted-42$/m);

  await paneMenu(window, 'Split Right');
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(2);
});

test('tabs move left and right from their menu', async ({ window }) => {
  await window.ready();
  await window.press('Meta+t');
  await expect.poll(async () => (await window.workspace()).length).toBe(2);
  const [first, second] = (await window.workspace()).map((tab) => tab.id);
  await window.page.locator(`[data-tab-id="${String(second)}"]`).click({ button: 'right' });
  await menuItem(window, 'Move Left').click();
  await expect
    .poll(async () => (await window.workspace()).map((tab) => tab.id))
    .toEqual([second, first]);
});

test('a running program shows how long it has been running on its tab', async ({ window }) => {
  await window.ready();
  await window.type('sleep 30\n');
  const badge = window.page.getByTestId('tab-elapsed');
  await expect(badge).toBeVisible({ timeout: 10_000 });
  await expect(badge).toHaveText(/^\d+s$/);
  await window.press('Control+c');
  await expect(badge).toHaveCount(0, { timeout: 10_000 });
});

test.describe('shell setting', () => {
  test.use({ initialSettings: '{ "shell": "/bin/zsh" }' });

  test('new panes start the configured shell', async ({ window }) => {
    await expect.poll(() => window.processName()).toBe('zsh');
  });
});
