import { expect, test } from './fixtures/app';

test('tabs: open, switch by number and cycle', async ({ window }) => {
  await window.press('Meta+t');
  await window.press('Meta+t');
  await expect.poll(async () => (await window.workspace()).length).toBe(3);
  await window.ready();

  await window.press('Meta+1');
  await expect.poll(async () => (await window.workspace()).findIndex((t) => t.active)).toBe(0);
  await window.press('Meta+Shift+BracketRight');
  await expect.poll(async () => (await window.workspace()).findIndex((t) => t.active)).toBe(1);
  await window.press('Control+Tab');
  await window.press('Control+Tab');
  await expect.poll(async () => (await window.workspace()).findIndex((t) => t.active)).toBe(0);
  await expect(window.page.getByTestId('tab')).toHaveCount(3);
});

test('split inherits the working directory and panes navigate by direction', async ({ window }) => {
  await window.type('cd /usr/bin\n');
  await expect.poll(() => window.terminalText()).toMatch(/cd \/usr\/bin/);
  const left = await window.activePane();

  await window.press('Meta+d');
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(2);
  await window.ready();
  const right = await window.activePane();
  expect(right).not.toBe(left);
  await window.type('pwd\n');
  await expect.poll(() => window.terminalText()).toMatch(/^\/usr\/bin$/m);

  await window.press('Meta+Alt+ArrowLeft');
  await expect.poll(() => window.activePane()).toBe(left);
  await window.press('Meta+BracketRight');
  await expect.poll(() => window.activePane()).toBe(right);

  await window.press('Meta+Shift+Enter');
  await expect.poll(async () => (await window.workspace())[0]?.zoomed).toBe(true);
  await window.press('Meta+Shift+Enter');
  await expect.poll(async () => (await window.workspace())[0]?.zoomed).toBe(false);

  await window.press('Meta+Shift+d');
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(3);
  await expect(window.page.getByTestId('divider')).toHaveCount(2);

  await window.press('Meta+w');
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(2);
});

test('a hidden tab keeps its output but draws nothing until shown', async ({ window }) => {
  await window.ready();
  const pane = await window.activePane();
  if (pane === undefined) throw new Error('no pane');
  await window.type('for i in $(seq 1 100); do echo "tick-$i"; sleep 0.02; done\n');
  await window.press('Meta+t');
  await window.ready();
  const before = await window.renders(pane);
  await expect.poll(() => window.terminalText(pane), { timeout: 15_000 }).toMatch(/^tick-100$/m);
  expect(await window.renders(pane)).toBe(before);

  await window.press('Meta+1');
  await expect.poll(() => window.renders(pane)).toBeGreaterThan(before);
});

test('dragging a divider resizes both panes', async ({ window }) => {
  await window.press('Meta+d');
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(2);
  // Past 200 lines a change of columns waits for the drag to settle; the shell still gets it.
  await window.ready();
  await window.type('seq 1 300; echo "cols=$(tput cols)"\n');
  await expect.poll(() => window.terminalText()).toMatch(/^cols=\d+$/m);
  const columns = async (): Promise<number> =>
    Number([...(await window.terminalText()).matchAll(/^cols=(\d+)$/gm)].at(-1)?.[1]);
  const columnsBefore = await columns();
  const divider = window.page.getByTestId('divider');
  const box = await divider.boundingBox();
  if (box === null) throw new Error('divider not visible');
  const panes = window.page.getByTestId('pane');
  const before = (await panes.first().boundingBox())?.width ?? 0;

  await window.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await window.page.mouse.down();
  await window.page.mouse.move(box.x - 200, box.y + box.height / 2, { steps: 5 });
  await window.page.mouse.up();

  await expect
    .poll(async () => (await panes.first().boundingBox())?.width ?? 0)
    .toBeLessThan(before - 150);

  // The right pane grew; its shell hears of the new width once the drag has settled.
  await window.type('sleep 1; echo "cols=$(tput cols)"\n');
  await expect.poll(columns).toBeGreaterThan(columnsBefore + 10);
});

test('a clean exit closes the pane, a failing one shows the exit overlay', async ({ window }) => {
  await window.press('Meta+d');
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(2);
  await window.ready();
  await window.type('exit 3\n');
  await expect(window.page.getByTestId('exit-overlay')).toContainText('exited with code 3');

  await window.page.keyboard.press('Enter');
  await expect(window.page.getByTestId('exit-overlay')).toHaveCount(0);
  await window.ready();
  await window.type('exit 0\n');
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(1);
});

test('closing a pane with a running program asks first', async ({ window }) => {
  await window.press('Meta+d');
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(2);
  await window.ready();
  await window.type('sleep 300\n');
  await expect.poll(() => window.processName()).toBe('sleep');

  await window.press('Meta+w');
  const dialog = window.page.getByTestId('confirm-dialog');
  await expect(dialog).toContainText('sleep is still running');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect((await window.workspace())[0]?.panes.length).toBe(2);

  await window.press('Meta+w');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(1);
});

test('font size zooms per window', async ({ window }) => {
  const base = await window.fontSize();
  await window.press('Meta+Equal');
  await window.press('Meta+Equal');
  await expect.poll(() => window.fontSize()).toBe(base + 2);
  await window.press('Meta+0');
  await expect.poll(() => window.fontSize()).toBe(base);
});
