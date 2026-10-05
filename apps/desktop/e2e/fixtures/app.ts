import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

const appDirectory = resolve(import.meta.dirname, '../..');

interface ProbeWindow {
  readonly __glaceonE2E: {
    terminalText(): string;
    sessionPid(): number | undefined;
  };
}

export interface GlaceonWindow {
  readonly page: Page;
  terminalText(): Promise<string>;
  sessionPid(): Promise<number | undefined>;
  type(text: string): Promise<void>;
}

function wrap(page: Page): GlaceonWindow {
  return {
    page,
    terminalText: () =>
      page.evaluate(() => (window as unknown as ProbeWindow).__glaceonE2E.terminalText()),
    sessionPid: () =>
      page.evaluate(() => (window as unknown as ProbeWindow).__glaceonE2E.sessionPid()),
    type: (text) => page.keyboard.type(text),
  };
}

/**
 * Dev builds run from `out/`. Setting GLACEON_E2E_EXECUTABLE runs the packaged app instead,
 * with the bare environment Finder gives an app (no LANG, minimal PATH).
 */
function launchOptions(home: string): Parameters<typeof electron.launch>[0] {
  const executablePath = process.env['GLACEON_E2E_EXECUTABLE'];
  const shared = { GLACEON_E2E: '1', HOME: home, SHELL: '/bin/sh', ENV: '' };
  if (executablePath === undefined) {
    return { args: [appDirectory], env: { ...process.env, ...shared } };
  }
  return {
    executablePath,
    args: [],
    env: {
      ...shared,
      PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
      USER: process.env['USER'] ?? 'e2e',
      TMPDIR: tmpdir(),
    },
  };
}

export const test = base.extend<{ app: ElectronApplication; window: GlaceonWindow }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern
  app: async ({}, use) => {
    const home = await mkdtemp(join(tmpdir(), 'glaceon-e2e-'));
    const app = await electron.launch(launchOptions(home));
    await use(app);
    await app.close();
    await rm(home, { recursive: true, force: true });
  },
  window: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForFunction(() => '__glaceonE2E' in window);
    await use(wrap(page));
  },
});

export const isPackagedRun = process.env['GLACEON_E2E_EXECUTABLE'] !== undefined;

export { expect } from '@playwright/test';
