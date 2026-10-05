import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type GlaceonWindow } from './fixtures/app';

// Measurements, not assertions: run with `pnpm bench` (skipped in `pnpm verify`).
test.skip(process.env['GLACEON_BENCH'] !== '1', 'benchmarks run with pnpm bench');

const results: Record<string, string> = {};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

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
