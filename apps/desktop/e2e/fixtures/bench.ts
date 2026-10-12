import type { Page } from '@playwright/test';
import type { GlaceonWindow } from './app';

/** Helpers for bench.spec.ts: statistics, frame timing and test programs. */

export function percentile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? Number.NaN;
}

export const median = (values: readonly number[]): number => percentile(values, 0.5);
export const ms = (value: number): string => `${value.toFixed(0)} ms`;
export const mb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(0);
export const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

interface BenchGlobals {
  __frames?: { deltas: number[]; running: boolean };
  __switched?: Promise<number>;
}

/** Records the time between animation frames until the returned function is called. */
export async function recordFrames(page: Page): Promise<() => Promise<number[]>> {
  await page.evaluate(() => {
    const state = { deltas: [] as number[], running: true };
    (globalThis as BenchGlobals).__frames = state;
    let last = performance.now();
    const tick = (now: number): void => {
      if (!state.running) return;
      state.deltas.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () =>
    page.evaluate(() => {
      const state = (globalThis as BenchGlobals).__frames;
      if (state === undefined) return [];
      state.running = false;
      return state.deltas;
    });
}

export const frameSummary = (deltas: readonly number[]): string =>
  `${ms(median(deltas))} / ${ms(percentile(deltas, 0.95))} / ${ms(Math.max(...deltas))}`;

/** Presses `keys` and resolves with the time until every pane in `panes` has drawn a frame. */
export async function switchTabs(
  target: GlaceonWindow,
  keys: string,
  panes: readonly string[],
): Promise<number> {
  await target.page.evaluate((ids) => {
    const probe = window.__glaceonE2E;
    (globalThis as BenchGlobals).__switched = new Promise<number>((resolve) => {
      let start = 0;
      let before: number[] = [];
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === 'Meta') return;
        window.removeEventListener('keydown', onKey, true);
        start = performance.now();
        before = ids.map((id) => probe.renders(id));
      };
      window.addEventListener('keydown', onKey, true);
      const check = (): void => {
        if (start > 0 && ids.every((id, index) => probe.renders(id) > (before[index] ?? 0))) {
          resolve(performance.now() - start);
        } else {
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    });
  }, panes);
  await target.press(keys);
  return target.page.evaluate(() => (globalThis as BenchGlobals).__switched ?? 0);
}

/**
 * A gradient sweeping over text, like a CLI spinner. Each channel takes 10 levels, so the
 * glyph atlas can grow to every letter in 1000 colors, but no further.
 */
export const SHIMMER = String.raw`$| = 1;
my @chars = split //, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?';
my $t = 0;
print "\e[2J\e[?25l";
while (1) {
  my $out = "\e[H";
  for my $row (0 .. 5) {
    for my $col (0 .. 47) {
      my $p = ($col + $row * 7) / 6 + $t / 5;
      my @rgb = map { 30 + 25 * int(4.999 * (1 + sin($p * $_->[0] + $t / $_->[1]))) }
        ([1, 7], [1.3, 11], [0.7, 13]);
      $out .= sprintf("\e[38;2;%d;%d;%dm%s", @rgb, $chars[($col * 7 + $row * 3 + $t) % @chars]);
    }
    $out .= "\e[0m\n";
  }
  print $out;
  $t++;
  select(undef, undef, undef, 1 / 30);
}
`;
