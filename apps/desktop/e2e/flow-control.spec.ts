import { expect, test } from './fixtures/app';

test('⌃C interrupts a flood of output immediately', async ({ window }) => {
  await window.type('yes 0123456789abcdefghijklmnopqrstuvwxyz\n');
  await window.page.waitForTimeout(1500);

  const started = Date.now();
  await window.press('Control+c');
  await window.type('echo "done-$((6 * 7))"\n');
  await expect.poll(() => window.terminalText(), { timeout: 5000 }).toMatch(/^done-42$/m);
  expect(Date.now() - started).toBeLessThan(5000);
});
