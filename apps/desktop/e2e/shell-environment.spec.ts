import { expect, isPackagedRun, test } from './fixtures/app';

test('shell gets terminal variables and a locale', async ({ window }) => {
  await expect.poll(() => window.sessionPid()).toBeGreaterThan(0);

  await window.type('echo "[$TERM_PROGRAM|$TERM|$COLORTERM|${LANG:-none}]"\n');

  await expect
    .poll(() => window.terminalText())
    .toMatch(/^\[Glaceon\|xterm-256color\|truecolor\|[a-zA-Z_]+\.UTF-8\]$/m);
});

test('login shell builds a full PATH even from a bare app environment', async ({ window }) => {
  test.skip(!isPackagedRun, 'only meaningful for the packaged app launched like Finder does');
  await expect.poll(() => window.sessionPid()).toBeGreaterThan(0);

  await window.type('echo "[${PATH}]"\n');

  await expect.poll(() => window.terminalText()).toMatch(/^\[.*\/usr\/local\/bin.*\]$/m);
});
