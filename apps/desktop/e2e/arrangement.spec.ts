import type { Page } from '@playwright/test';
import { expect, test, type ProbeTab } from './fixtures/app';

const firstTab = async (window: { workspace(): Promise<ProbeTab[]> }): Promise<ProbeTab> => {
  const [tab] = await window.workspace();
  if (tab === undefined) throw new Error('no tab');
  return tab;
};

async function runPalette(page: Page, query: string): Promise<void> {
  await page.keyboard.press('Meta+Shift+p');
  await page.keyboard.type(query);
  await expect(page.getByTestId('palette').getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('palette')).toHaveCount(0);
}

test('a 2×2 layout on three panes keeps all three shells running', async ({ window }) => {
  await window.press('Meta+d');
  await expect.poll(async () => (await firstTab(window)).panes.length).toBe(2);
  await window.press('Meta+Shift+d');
  await expect.poll(async () => (await firstTab(window)).panes.length).toBe(3);
  const before = (await firstTab(window)).panes;
  for (const pane of before) await expect.poll(() => window.sessionPid(pane)).toBeDefined();
  const pids = await Promise.all(before.map((pane) => window.sessionPid(pane)));

  await runPalette(window.page, '2×2');
  await expect.poll(async () => (await firstTab(window)).panes.length).toBe(4);
  const after = await firstTab(window);
  expect(after.panes.slice(0, 3)).toEqual(before);
  expect(after.rects.map((r) => [r.width, r.height])).toEqual([
    [0.5, 0.5],
    [0.5, 0.5],
    [0.5, 0.5],
    [0.5, 0.5],
  ]);
  for (const [index, pane] of before.entries()) {
    expect(await window.sessionPid(pane)).toBe(pids[index]);
    await window.page.locator(`[data-pane="${pane}"]`).click();
    await window.type('echo pid=$$\n');
    await expect.poll(() => window.terminalText(pane)).toContain(`pid=${String(pids[index])}`);
  }
  await expect.poll(() => window.sessionPid(after.panes[3])).toBeDefined();
});

test('dragging a pane by its grip splits or swaps the target', async ({ window }) => {
  await window.press('Meta+d');
  await expect.poll(async () => (await firstTab(window)).panes.length).toBe(2);
  const [left, right] = (await firstTab(window)).panes;
  const pid = await window.sessionPid(right);

  const drag = async (
    source: string | undefined,
    to: (box: { x: number; y: number; width: number; height: number }) => { x: number; y: number },
    target: string | undefined,
  ) => {
    const slot = window.page.locator(`[data-pane="${source ?? ''}"]`);
    await slot.hover();
    const grip = slot.getByTestId('pane-grip');
    const from = await grip.boundingBox();
    const box = await window.page.locator(`[data-pane="${target ?? ''}"]`).boundingBox();
    if (from === null || box === null) throw new Error('no boxes');
    await window.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await window.page.mouse.down();
    const point = to(box);
    await window.page.mouse.move(point.x, point.y, { steps: 8 });
    await expect(window.page.getByTestId('drop-preview')).toBeVisible();
    await window.page.mouse.up();
  };

  // Onto the top edge of the left pane: right pane goes above it.
  await drag(right, (b) => ({ x: b.x + b.width / 2, y: b.y + 10 }), left);
  await expect
    .poll(async () => (await firstTab(window)).rects.map((r) => [r.pane, r.y]))
    .toEqual([
      [right, 0],
      [left, 0.5],
    ]);
  // Onto the center: swap.
  await drag(right, (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }), left);
  await expect.poll(async () => (await firstTab(window)).panes).toEqual([left, right]);
  expect(await window.sessionPid(right)).toBe(pid);
  await expect(window.page.getByTestId('drop-preview')).toHaveCount(0);
});

test('tabs can be renamed, colored, pinned, locked, grouped and reordered', async ({ window }) => {
  const page = window.page;
  await window.press('Meta+t');
  await window.press('Meta+t');
  await expect(page.getByTestId('tab')).toHaveCount(3);
  const ids = (await window.workspace()).map((tab) => tab.id);
  const tab = (id: string | undefined) => page.locator(`[data-tab-id="${id ?? ''}"]`);

  // Rename by double-click.
  await tab(ids[1]).dblclick();
  await page.getByLabel('Tab name').fill('server');
  await page.keyboard.press('Enter');
  await expect(tab(ids[1])).toContainText('server');

  // Color and lock from the context menu.
  const menu = async (id: string | undefined, item: string) => {
    await tab(id).click({ button: 'right' });
    await page
      .getByTestId('context-menu')
      .getByRole(item === 'red' ? 'menuitemradio' : 'menuitem', { name: item })
      .click();
  };
  await menu(ids[1], 'red');
  await menu(ids[1], 'Lock Tab');
  await expect(tab(ids[1])).toHaveAttribute('data-color', 'red');
  await tab(ids[1]).click();
  await window.press('Meta+w');
  await expect(page.getByTestId('toast')).toContainText('locked');
  await expect(page.getByTestId('tab')).toHaveCount(3);

  // Pinning moves the tab to the front.
  await menu(ids[2], 'Pin Tab');
  await expect
    .poll(async () => (await window.workspace()).map((t) => t.id))
    .toEqual([ids[2], ids[0], ids[1]]);

  // New group: the label appears and is renamed inline.
  await menu(ids[0], 'Add to New Group');
  await page.getByLabel('Group name').fill('build');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tab-group')).toHaveText('build');
  await expect
    .poll(async () => (await window.workspace()).find((t) => t.id === ids[0])?.group)
    .toBe('build');

  // Drag the locked tab to the left of the grouped one: it joins nothing and moves.
  const target = await tab(ids[0]).boundingBox();
  const source = await tab(ids[1]).boundingBox();
  if (target === null || source === null) throw new Error('no boxes');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 4, target.y + target.height / 2, { steps: 10 });
  await expect(page.getByTestId('tab-drop-marker')).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(async () => (await window.workspace()).map((t) => t.id))
    .toEqual([ids[2], ids[1], ids[0]]);

  // Collapsing the group hides its (inactive) tab.
  await tab(ids[1]).click();
  await page.getByTestId('tab-group').click();
  await expect(tab(ids[0])).toHaveCount(0);
});
