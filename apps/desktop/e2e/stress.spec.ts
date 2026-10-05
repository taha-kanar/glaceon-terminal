import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';
import { expect, test, type GlaceonWindow } from './fixtures/app';

async function panes(window: GlaceonWindow): Promise<readonly string[]> {
  return (await window.workspace())[0]?.panes ?? [];
}

async function pidsOf(window: GlaceonWindow, ids: readonly string[]): Promise<number[]> {
  const pids: number[] = [];
  for (const pane of ids) {
    await expect.poll(() => window.sessionPid(pane)).toBeDefined();
    pids.push((await window.sessionPid(pane)) ?? 0);
  }
  return pids;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function describe(pid: number): string {
  try {
    return execFileSync('/bin/ps', ['-o', 'ppid=,ucomm=,lstart=', '-p', String(pid)]).toString();
  } catch {
    return 'gone';
  }
}

async function runPalette(page: Page, query: string): Promise<void> {
  await page.keyboard.press('Meta+Shift+p');
  await page.keyboard.type(query);
  await expect(page.getByTestId('palette').getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('palette')).toHaveCount(0);
}

/** Opens `count` panes next to the current ones and waits until each has a shell. */
async function openPanes(window: GlaceonWindow, count: number): Promise<number[]> {
  const before = await panes(window);
  for (let index = 0; index < count; index++) {
    await window.press(index % 2 === 0 ? 'Meta+d' : 'Meta+Shift+d');
  }
  await expect.poll(async () => (await panes(window)).length).toBe(before.length + count);
  const added = (await panes(window)).filter((pane) => !before.includes(pane));
  return pidsOf(window, added);
}

test('opening and closing 200 panes leaks no views, sessions, nodes or shells', async ({
  window,
}) => {
  test.setTimeout(240_000);
  const ROUNDS = 40;
  const PER_ROUND = 5;
  await window.ready();

  // ⌘W closes whichever pane is active, so the survivor of a round may be one it opened.
  const cycle = async (): Promise<number[]> => {
    await openPanes(window, PER_ROUND);
    const pids = await pidsOf(window, await panes(window));
    for (let index = 0; index < PER_ROUND; index++) await window.press('Meta+w');
    await expect.poll(async () => (await panes(window)).length).toBe(1);
    const survivor = await window.sessionPid();
    return pids.filter((pid) => pid !== survivor);
  };

  // A warm-up round, so lazily created caches count toward the baseline.
  const closed = await cycle();
  const baseline = await window.resources();
  for (let round = 1; round < ROUNDS; round++) closed.push(...(await cycle()));
  expect(closed).toHaveLength(ROUNDS * PER_ROUND);

  await expect
    .poll(() => closed.filter(alive).map((pid) => `${String(pid)} ${describe(pid)}`), {
      timeout: 20_000,
    })
    .toEqual([]);
  await expect.poll(async () => (await window.resources()).sessions).toBe(1);
  const after = await window.resources();
  expect(after.views).toBe(1);
  expect(after.domNodes).toBeLessThanOrEqual(baseline.domNodes + 20);
  expect(baseline.heap).toBeDefined();
  expect(after.heap ?? Infinity).toBeLessThan((baseline.heap ?? 0) + 8 * 1024 * 1024);

  // The survivor still works.
  await window.type('echo still-alive\n');
  await expect.poll(() => window.terminalText()).toMatch(/^still-alive$/m);
});

test('24 visible panes all render and respond, within the WebGL context budget', async ({
  window,
}) => {
  test.setTimeout(120_000);
  await window.ready();
  // Re-tile after each batch so the panes never get too thin to split.
  while ((await panes(window)).length < 24) {
    await openPanes(window, Math.min(5, 24 - (await panes(window)).length));
    await runPalette(window.page, 'Grid');
  }
  const all = await panes(window);
  expect(all).toHaveLength(24);
  const rects = (await window.workspace())[0]?.rects ?? [];
  for (const rect of rects) expect(rect.width * rect.height).toBeGreaterThan(1 / 40);

  // Flood every pane at once, then make sure each one still answers.
  for (const pane of all) {
    await window.page.locator(`[data-pane="${pane}"]`).click();
    await window.type(`seq 1 3000; echo "done-${pane}"\n`);
  }
  for (const pane of all) {
    await expect.poll(() => window.terminalText(pane)).toMatch(new RegExp(`^done-${pane}$`, 'm'));
  }

  const resources = await window.resources();
  expect(resources.views).toBe(24);
  // Chromium allows 16 WebGL contexts; panes past the window's budget use the DOM renderer.
  expect(resources.webglViews).toBe(12);

  // Hiding the tab frees its contexts; showing it again takes them back.
  await window.press('Meta+t');
  await expect.poll(async () => (await window.resources()).webglViews).toBe(1);
  await window.press('Meta+1');
  await expect.poll(async () => (await window.resources()).webglViews).toBe(12);
  const problems = await window.problems();
  expect(problems).toEqual([]);
});
