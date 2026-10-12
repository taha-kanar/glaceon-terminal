import { execFileSync } from 'node:child_process';
import {
  activePanes as panes,
  expect,
  newWindowFrom,
  runPalette,
  test,
  typeInPane,
  type GlaceonWindow,
} from './fixtures/app';

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

const MB = 1024 * 1024;

/**
 * Released renderers must not keep their glyph atlas alive. Polled, because idle-time work
 * (the atlas warm-up) may hold a page for a moment.
 */
async function expectNoLeakedAtlas(window: GlaceonWindow): Promise<void> {
  await expect.poll(async () => (await window.resources()).leakedAtlasBytes).toBe(0);
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
  await expectNoLeakedAtlas(window);
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

/** A tab of six panes in a grid, each showing a screenful of text. */
async function sixPaneTab(window: GlaceonWindow): Promise<readonly string[]> {
  await openPanes(window, 5);
  await runPalette(window.page, 'Grid');
  const tab = await panes(window);
  for (const pane of tab) await typeInPane(window, pane, 'seq 1 200\n');
  return tab;
}

test('switching between two 6-pane tabs stays within the WebGL context limit', async ({
  window,
}) => {
  test.setTimeout(120_000);
  let warnings = 0;
  window.page.on('console', (message) => {
    if (message.text().includes('Too many active WebGL contexts')) warnings++;
  });
  await window.ready();
  const first = await sixPaneTab(window);
  await window.press('Meta+t');
  await window.ready();
  const second = await sixPaneTab(window);
  await window.press('Meta+1');
  await window.press('Meta+2');
  const baseline = await window.resources();

  // No forced GC in between: freed contexts must go at once, not when collected.
  for (let index = 0; index < 30; index++) {
    await window.press(index % 2 === 0 ? 'Meta+1' : 'Meta+2');
    const visible = index % 2 === 0 ? first : second;
    await expect
      .poll(async () => {
        const kinds = await Promise.all(visible.map((pane) => window.rendererKind(pane)));
        return kinds.every((kind) => kind === 'webgl');
      })
      .toBe(true);
  }
  expect(warnings).toBe(0);
  const after = await window.resources();
  expect(after.contextLosses).toBe(0);
  await expectNoLeakedAtlas(window);
  expect(after.webglViews).toBe(6);
  expect(after.domNodes).toBeLessThanOrEqual(baseline.domNodes + 20);
});

test('changing the theme 20 times leaves one glyph atlas and a flat heap', async ({ window }) => {
  test.setTimeout(120_000);
  await window.ready();
  await openPanes(window, 3);
  for (const pane of await panes(window)) await typeInPane(window, pane, 'seq 1 200\n');
  const accent = (): Promise<string> =>
    window.page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    );
  const setTheme = async (theme: string): Promise<void> => {
    const before = await accent();
    await window.page.evaluate(
      (value) =>
        (
          window as unknown as {
            glaceon: { updateSetting(request: { key: string; value: unknown }): Promise<unknown> };
          }
        ).glaceon.updateSetting({ key: 'theme', value }),
      theme,
    );
    await expect.poll(accent, { intervals: [10] }).not.toBe(before);
  };
  // Each theme once, so lazily made caches count toward the baseline. Every theme has its
  // own accent, so the next one is applied once the accent changes.
  const themes = ['dracula', 'nord', 'gruvbox-dark', 'one-dark', 'tokyo-night'];
  for (const theme of themes) await setTheme(theme);
  const baseline = await window.resources();
  expect(baseline.atlasBytes).toBeGreaterThan(0);

  for (let index = 0; index < 20; index++) await setTheme(themes[index % themes.length] ?? 'nord');
  await expect
    .poll(async () => (await window.resources()).atlasBytes)
    .toBeLessThanOrEqual(baseline.atlasBytes + 4 * MB);
  const after = await window.resources();
  expect(after.atlasSwaps).toBeGreaterThanOrEqual(baseline.atlasSwaps + 20);
  expect(after.heap ?? Infinity).toBeLessThan((baseline.heap ?? 0) + 8 * MB);
  expect(after.contextLosses).toBe(0);
});

test('50 exits and restarts leak no sessions, views or shells', async ({ window }) => {
  test.setTimeout(120_000);
  await window.ready();
  const cycle = async (): Promise<number> => {
    const pid = (await window.sessionPid()) ?? 0;
    await window.type('exit 3\n');
    await expect(window.page.getByTestId('exit-overlay')).toBeVisible();
    await window.press('Enter');
    await expect(window.page.getByTestId('exit-overlay')).toHaveCount(0);
    await window.ready();
    return pid;
  };
  const exited = [await cycle()];
  const baseline = await window.resources();
  for (let index = 1; index < 50; index++) exited.push(await cycle());

  await expect.poll(() => exited.filter(alive), { timeout: 20_000 }).toEqual([]);
  const after = await window.resources();
  expect(after.sessions).toBe(1);
  expect(after.views).toBe(1);
  await expectNoLeakedAtlas(window);
  expect(after.domNodes).toBeLessThanOrEqual(baseline.domNodes + 20);
  expect(after.heap ?? Infinity).toBeLessThan((baseline.heap ?? 0) + 8 * MB);
});

test('moving a tab to a new window and back 10 times leaks nothing', async ({ app, window }) => {
  test.setTimeout(180_000);
  await window.ready();
  await window.press('Meta+t');
  await window.ready();
  await window.type('echo moving-marker\n');
  const pid = await window.sessionPid();

  const roundTrip = async (): Promise<void> => {
    const moved = await newWindowFrom(app, () => runPalette(window.page, 'move tab to new window'));
    await expect.poll(async () => (await window.workspace()).length).toBe(1);
    await moved.page.getByTestId('tab').first().click({ button: 'right' });
    const closed = moved.page.waitForEvent('close');
    await moved.page
      .getByTestId('context-menu')
      .getByRole('menuitem', { name: 'Move to Window 1' })
      .click();
    await closed;
    await expect.poll(async () => (await window.workspace()).length).toBe(2);
    await expect.poll(() => window.sessionPid()).toBe(pid);
  };
  await roundTrip();
  const baseline = await window.resources();
  for (let index = 1; index < 10; index++) await roundTrip();

  expect(app.windows()).toHaveLength(1);
  const after = await window.resources();
  expect(after.sessions).toBe(2);
  expect(after.views).toBe(2);
  await expectNoLeakedAtlas(window);
  expect(after.domNodes).toBeLessThanOrEqual(baseline.domNodes + 20);
  expect(after.heap ?? Infinity).toBeLessThan((baseline.heap ?? 0) + 8 * MB);
  await window.type('echo still-here\n');
  await expect.poll(() => window.terminalText()).toMatch(/^still-here$/m);
});
