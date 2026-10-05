import { expect, test } from './fixtures/app';

test('the job panel shows process trees with CPU usage and stops jobs', async ({ window }) => {
  const page = window.page;
  await window.type('yes > /dev/null &\n');
  await window.type('sleep 300\n');
  await expect.poll(() => window.processName()).toBe('sleep');

  await window.press('Meta+Shift+j');
  const panel = page.getByTestId('jobs-panel');
  await expect(panel).toBeVisible();
  const sleep = panel.locator('[data-testid="job"][data-name="sleep"]');
  const yes = panel.locator('[data-testid="job"][data-name="yes"]');
  await expect(sleep).toHaveCount(1);
  // CPU comes from the change in CPU time between two samples.
  await expect
    .poll(async () => Number(await yes.getAttribute('data-cpu')), { timeout: 10_000 })
    .toBeGreaterThan(40);

  await yes.getByTitle('Kill (SIGKILL)').click();
  await expect(yes).toHaveCount(0, { timeout: 10_000 });
  await sleep.getByTitle('Terminate (SIGTERM)').click();
  await expect(sleep).toHaveCount(0, { timeout: 10_000 });

  await window.press('Escape');
  await expect(panel).toHaveCount(0);
  await window.type('echo after-$?\n');
  await expect.poll(() => window.terminalText()).toMatch(/^after-143$/m);
});

test('hovering the process indicator lists every pane', async ({ window }) => {
  await window.press('Meta+t');
  await expect(window.page.getByTestId('tab')).toHaveCount(2);
  await window.ready();
  await window.type('sleep 200\n');
  const indicator = window.page.getByTestId('process-indicator');
  await expect(indicator).toContainText('1 running');
  await indicator.hover();
  const rows = window.page.getByTestId('process-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText('sleep');
  await expect(rows.nth(1)).toContainText('%');
  await rows.first().click();
  await expect.poll(async () => (await window.workspace()).findIndex((t) => t.active)).toBe(0);
});
