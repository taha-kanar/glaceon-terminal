import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  activePanes,
  cpuSeconds,
  expect,
  gpuMemory,
  openPanes,
  runPalette,
  test,
  typeInPane,
  type GlaceonWindow,
} from './fixtures/app';
import {
  frameSummary,
  mb,
  median,
  ms,
  percentile,
  recordFrames,
  SHIMMER,
  sleep,
  switchTabs,
} from './fixtures/bench';

// Measurements, not assertions: run with `pnpm bench` (skipped in `pnpm verify`).
test.skip(process.env['GLACEON_BENCH'] !== '1', 'benchmarks run with pnpm bench');

const results: Record<string, string> = {};

/** Polls sparingly: reading the whole buffer is itself work for the renderer. */
async function waitForText(window: GlaceonWindow, pattern: RegExp, pane?: string): Promise<void> {
  await expect
    .poll(() => window.terminalText(pane), { intervals: [50], timeout: 60_000 })
    .toMatch(pattern);
}

test.afterAll(async () => {
  // eslint-disable-next-line no-console -- the report is the point of a benchmark
  console.table(results);
  await writeFile(
    join(import.meta.dirname, '../test-results/bench.json'),
    JSON.stringify(results, null, 2),
  );
});

test('throughput: 64 MB of output', async ({ window }) => {
  test.setTimeout(120_000);
  await window.ready();
  const megabytes = 64;
  const started = performance.now();
  await window.type(
    `yes 'The quick brown fox jumps over the lazy dog 0123456789 ~!@#$%^&*()_+ []{}' | head -c ${String(megabytes * 1024 * 1024)}; echo; echo bench-$((1+1))\n`,
  );
  await waitForText(window, /^bench-2$/m);
  const seconds = (performance.now() - started) / 1000;
  results['throughput'] = `${(megabytes / seconds).toFixed(1)} MB/s`;
});

test('latency: new pane until its prompt', async ({ window }) => {
  await window.ready();
  const samples: number[] = [];
  for (let index = 0; index < 10; index++) {
    const started = performance.now();
    await window.press('Meta+d');
    await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(2);
    await window.ready();
    samples.push(performance.now() - started);
    await window.press('Meta+w');
    await expect.poll(async () => (await window.workspace())[0]?.panes.length).toBe(1);
  }
  results['new pane → prompt (median)'] = `${median(samples).toFixed(0)} ms`;
});

test('latency: keystroke until it is echoed', async ({ window }) => {
  await window.ready();
  const samples: number[] = [];
  for (let index = 0; index < 40; index++) {
    const marker = String.fromCharCode(97 + (index % 26));
    const before = (await window.terminalText()).length;
    const started = performance.now();
    await window.type(marker);
    await expect
      .poll(async () => (await window.terminalText()).length, { intervals: [1], timeout: 5000 })
      .toBeGreaterThan(before);
    samples.push(performance.now() - started);
  }
  results['keystroke → echo (median, incl. probe)'] = `${median(samples).toFixed(1)} ms`;
});

/** The soak stops early past this GPU footprint, so a leak cannot take the machine down. */
const SOAK_GPU_LIMIT = 2 * 1024 * 1024 * 1024;

test('soak: truecolor shimmer in 4 panes for 3 minutes', async ({ app, window }) => {
  test.setTimeout(360_000);
  const dir = await mkdtemp(join(tmpdir(), 'glaceon-bench-'));
  const script = join(dir, 'shimmer.pl');
  await writeFile(script, SHIMMER);
  await window.ready();
  await openPanes(window, 3);
  await runPalette(window.page, 'Grid');
  const panes = await activePanes(window);
  for (const pane of panes) await typeInPane(window, pane, `perl ${script}\n`);

  const atlas: string[] = [];
  const gpu: string[] = [];
  const renderers: string[] = [];
  const heap: string[] = [];
  const started = performance.now();
  for (let second = 0; second <= 180; second += 15) {
    await sleep(Math.max(0, started + second * 1000 - performance.now()));
    const resources = await window.resources();
    const memory = await gpuMemory(app);
    atlas.push(mb(resources.atlasBytes));
    gpu.push(`${mb(memory.gpu)} (${mb(memory.gpuIOSurface)})`);
    renderers.push(mb(memory.renderers));
    heap.push(mb(resources.heap ?? 0));
    results['soak: max texture size'] = String(resources.maxTextureSize);
    results['soak: atlas recycles / leaked atlas MB'] =
      `${String(resources.atlasRecycles)} / ${mb(resources.leakedAtlasBytes)}`;
    if (memory.gpu > SOAK_GPU_LIMIT) {
      results['soak: stopped early'] = `GPU over ${mb(SOAK_GPU_LIMIT)} MB at ${String(second)} s`;
      break;
    }
  }
  results['soak: atlas MB every 15 s'] = atlas.join(' ');
  results['soak: GPU MB (IOSurface) every 15 s'] = gpu.join(' ');
  results['soak: renderer MB every 15 s'] = renderers.join(' ');
  results['soak: renderer JS heap MB every 15 s'] = heap.join(' ');
  for (const pane of panes) {
    await window.page.locator(`[data-pane="${pane}"]`).click();
    await window.press('Control+c');
  }
  await rm(dir, { recursive: true, force: true });
});

test('tab switching: two tabs of 6 panes, 50 switches', async ({ window }) => {
  test.setTimeout(240_000);
  let warnings = 0;
  window.page.on('console', (message) => {
    if (message.text().includes('Too many active WebGL contexts')) warnings++;
  });
  await window.ready();
  const fill = async (): Promise<readonly string[]> => {
    await openPanes(window, 5);
    await runPalette(window.page, 'Grid');
    const panes = await activePanes(window);
    for (const pane of panes) await typeInPane(window, pane, 'seq 1 300\n');
    return panes;
  };
  const first = await fill();
  await window.press('Meta+t');
  await expect.poll(async () => (await window.workspace()).length).toBe(2);
  await window.ready();
  const second = await fill();

  const before = await window.resources();
  const samples: number[] = [];
  for (let index = 0; index < 50; index++) {
    const back = index % 2 === 0;
    samples.push(await switchTabs(window, back ? 'Meta+1' : 'Meta+2', back ? first : second));
  }
  const after = await window.resources();
  results['tab switch → every pane drawn (median / p95)'] =
    `${ms(median(samples))} / ${ms(percentile(samples, 0.95))}`;
  results['tab switch: context losses'] = String(after.contextLosses - before.contextLosses);
  results['tab switch: "too many contexts" warnings'] = String(warnings);
  results['tab switch: WebGL views after'] = String(after.webglViews);
});

test('background output: a hidden tab printing 50 lines a second', async ({ app, window }) => {
  test.setTimeout(120_000);
  await window.ready();
  const pane = await window.activePane();
  if (pane === undefined) throw new Error('no pane');
  await window.type('while :; do date; sleep 0.02; done\n');
  await window.press('Meta+t');
  await expect.poll(async () => (await window.workspace()).length).toBe(2);
  await window.ready();
  await sleep(2000);

  const seconds = 20;
  const rendersBefore = await window.renders(pane);
  const cpuBefore = await cpuSeconds(app);
  await sleep(seconds * 1000);
  const cpuAfter = await cpuSeconds(app);
  const rendersAfter = await window.renders(pane);
  const percent = (type: string): string =>
    `${((((cpuAfter[type] ?? 0) - (cpuBefore[type] ?? 0)) / seconds) * 100).toFixed(1)} %`;
  results['background: hidden pane frames/s'] = ((rendersAfter - rendersBefore) / seconds).toFixed(
    1,
  );
  results['background: renderer CPU'] = percent('Tab');
  results['background: GPU process CPU'] = percent('GPU');
});

test('divider drag: two panes with full scrollback', async ({ window }) => {
  test.setTimeout(120_000);
  await window.ready();
  await openPanes(window, 1);
  const panes = await activePanes(window);
  for (const pane of panes) await typeInPane(window, pane, 'seq 1 12000; echo filled-$((1+1))\n');
  for (const pane of panes) {
    await expect.poll(() => window.terminalText(pane), { timeout: 60_000 }).toMatch(/^filled-2$/m);
  }
  const box = await window.page.getByTestId('divider').boundingBox();
  if (box === null) throw new Error('divider not visible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  const stop = await recordFrames(window.page);
  const started = performance.now();
  await window.page.mouse.move(x, y);
  await window.page.mouse.down();
  for (let step = 1; step <= 200; step++) {
    await window.page.mouse.move(x + 150 * Math.sin((step / 200) * 4 * Math.PI), y);
  }
  await window.page.mouse.up();
  const elapsed = performance.now() - started;
  await sleep(500);
  const frames = await stop();
  results['divider drag: 200 moves'] = ms(elapsed);
  results['divider drag: frame median / p95 / max'] = frameSummary(frames);
});

interface SettingsBridge {
  readonly glaceon: {
    updateSetting(request: { key: string; value: unknown }): Promise<unknown>;
  };
}

test('settings: background opacity changed 20 times', async ({ window }) => {
  test.setTimeout(120_000);
  await window.ready();
  await openPanes(window, 3);
  for (const pane of await activePanes(window)) await typeInPane(window, pane, 'seq 1 300\n');
  const surface = (): Promise<string> =>
    window.page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--surface'),
    );

  const before = await window.resources();
  const stop = await recordFrames(window.page);
  const started = performance.now();
  for (let index = 0; index < 20; index++) {
    const current = await surface();
    await window.page.evaluate(
      (value) =>
        (window as unknown as SettingsBridge).glaceon.updateSetting({
          key: 'backgroundOpacity',
          value,
        }),
      index % 2 === 0 ? 0.5 : 0.8,
    );
    await expect.poll(surface, { intervals: [5] }).not.toBe(current);
  }
  const elapsed = performance.now() - started;
  await sleep(300);
  const frames = await stop();
  const after = await window.resources();
  results['settings: 20 opacity changes'] = ms(elapsed);
  results['settings: atlas swaps'] = String(after.atlasSwaps - before.atlasSwaps);
  results['settings: frame median / p95 / max'] = frameSummary(frames);
});
