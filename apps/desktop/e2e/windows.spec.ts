import type { ElectronApplication } from '@playwright/test';
import { expect, newWindowFrom, test, type GlaceonWindow } from './fixtures/app';

/** Starts a second tab whose shell printed a marker, and returns its pane and pid. */
async function markedTab(window: GlaceonWindow, marker: string) {
  await window.press('Meta+t');
  await expect(window.page.getByTestId('tab')).toHaveCount(2);
  await window.ready();
  await window.type(`echo ${marker}\n`);
  await expect.poll(() => window.terminalText()).toMatch(new RegExp(`^${marker}$`, 'm'));
  const pane = await window.activePane();
  const pid = await window.sessionPid();
  if (pane === undefined || pid === undefined) throw new Error('no shell');
  return { pane, pid };
}

async function expectSameShell(window: GlaceonWindow, expected: { pid: number; marker: string }) {
  // Scrollback came along…
  await expect.poll(() => window.terminalText()).toMatch(new RegExp(`^${expected.marker}$`, 'm'));
  // …and it is the very same shell.
  expect(await window.sessionPid()).toBe(expected.pid);
  await window.type('echo "pid=$$"\n');
  await expect.poll(() => window.terminalText()).toContain(`pid=${String(expected.pid)}`);
}

async function runCommand(app: ElectronApplication, command: string, args?: number) {
  await app.evaluate(
    ({ BrowserWindow }, request) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('command:run', request);
    },
    args === undefined ? { command } : { command, args },
  );
}

test('a tab moves to a new window with its shell and scrollback', async ({ app, window }) => {
  const { pid } = await markedTab(window, 'scrollback-marker');
  const moved = await newWindowFrom(app, async () => {
    await window.press('Meta+Shift+p');
    await window.type('move tab to new window');
    await window.press('Enter');
  });
  await expectSameShell(moved, { pid, marker: 'scrollback-marker' });
  await expect.poll(async () => (await window.workspace()).length).toBe(1);
  expect(await moved.workspace()).toHaveLength(1);
});

test('a tab moves into another window from the tab menu', async ({ app, window }) => {
  const other = await newWindowFrom(app, () => window.press('Meta+n'));
  const { pid } = await markedTab(window, 'menu-marker');
  const tab = window.page.getByTestId('tab').nth(1);
  await tab.click({ button: 'right' });
  await window.page
    .getByTestId('context-menu')
    .getByRole('menuitem', { name: 'Move to Window 2' })
    .click();
  await expect.poll(async () => (await other.workspace()).length).toBe(2);
  await expect.poll(async () => (await window.workspace()).length).toBe(1);
  await expectSameShell(other, { pid, marker: 'menu-marker' });
});

test('dragging a tab out of the tab bar tears it off into a new window', async ({
  app,
  window,
}) => {
  const { pid } = await markedTab(window, 'torn-marker');
  const tab = await window.page.getByTestId('tab').nth(1).boundingBox();
  if (tab === null) throw new Error('no tab');
  const torn = await newWindowFrom(app, async () => {
    await window.page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
    await window.page.mouse.down();
    await window.page.mouse.move(tab.x + tab.width / 2 + 40, tab.y + 300, { steps: 12 });
    await window.page.mouse.up();
  });
  await expectSameShell(torn, { pid, marker: 'torn-marker' });
  await expect.poll(async () => (await window.workspace()).length).toBe(1);
});

test('a failed move rolls back and the shell keeps working here', async ({ app, window }) => {
  const { pid } = await markedTab(window, 'rollback-marker');
  await runCommand(app, 'tab.moveToWindow', 987_654);
  await expect(window.page.getByTestId('toast')).toContainText('could not be moved');
  expect(await window.workspace()).toHaveLength(2);
  await expectSameShell(window, { pid, marker: 'rollback-marker' });
  expect(app.windows()).toHaveLength(1);
});
