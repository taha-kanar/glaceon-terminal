import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

const appDirectory = resolve(import.meta.dirname, '../..');

export interface ProbeTab {
  readonly id: string;
  readonly active: boolean;
  readonly panes: readonly string[];
  readonly activePane: string;
  readonly zoomed: boolean;
  readonly title?: string;
  readonly color?: string;
  readonly pinned: boolean;
  readonly locked: boolean;
  /** Name of the tab's group. */
  readonly group?: string;
  /** Pane rectangles in unit coordinates, reading order. */
  readonly rects: readonly { pane: string; x: number; y: number; width: number; height: number }[];
}

interface Probe {
  terminalText(pane?: string): string;
  sessionPid(pane?: string): number | undefined;
  activePane(): string | undefined;
  workspace(): ProbeTab[];
  sessionInfo(pane: string): { process?: string; exit?: { exitCode: number } } | undefined;
  problems(): string[];
  fontSize(): number;
  locateText(text: string): { x: number; y: number } | undefined;
}

declare global {
  interface Window {
    readonly __glaceonE2E: Probe;
  }
}

export interface GlaceonWindow {
  readonly page: Page;
  terminalText(pane?: string): Promise<string>;
  sessionPid(pane?: string): Promise<number | undefined>;
  activePane(): Promise<string | undefined>;
  workspace(): Promise<ProbeTab[]>;
  processName(pane?: string): Promise<string | undefined>;
  problems(): Promise<string[]>;
  fontSize(): Promise<number>;
  /** ⌘-clicks the last occurrence of `text` in the active pane. */
  commandClick(text: string): Promise<void>;
  type(text: string): Promise<void>;
  press(keys: string): Promise<void>;
  /** Waits until the active pane has a running shell. */
  ready(): Promise<void>;
}

export function wrap(page: Page): GlaceonWindow {
  const self: GlaceonWindow = {
    page,
    terminalText: (pane) => page.evaluate((id) => window.__glaceonE2E.terminalText(id), pane),
    sessionPid: (pane) => page.evaluate((id) => window.__glaceonE2E.sessionPid(id), pane),
    activePane: () => page.evaluate(() => window.__glaceonE2E.activePane()),
    workspace: () => page.evaluate(() => window.__glaceonE2E.workspace()),
    processName: async (pane) => {
      const id = pane ?? (await self.activePane());
      if (id === undefined) return undefined;
      return page.evaluate((target) => window.__glaceonE2E.sessionInfo(target)?.process, id);
    },
    problems: () => page.evaluate(() => window.__glaceonE2E.problems()),
    fontSize: () => page.evaluate(() => window.__glaceonE2E.fontSize()),
    commandClick: async (text) => {
      const point = await page.evaluate((t) => window.__glaceonE2E.locateText(t), text);
      if (point === undefined) throw new Error(`"${text}" is not on screen`);
      // Nudge the pointer until xterm has resolved the link under it (a pointer cursor).
      await page.mouse.move(point.x - 3, point.y);
      await page.mouse.move(point.x, point.y, { steps: 3 });
      await page.waitForSelector('.xterm-cursor-pointer', { timeout: 3000 });
      await page.keyboard.down('Meta');
      await page.mouse.click(point.x, point.y);
      await page.keyboard.up('Meta');
    },
    type: (text) => page.keyboard.type(text),
    press: (keys) => page.keyboard.press(keys),
    // A pid alone is not enough: input typed before the shell prints its prompt can be lost.
    ready: async () => {
      await page.waitForFunction(() => {
        const probe = window.__glaceonE2E;
        return probe.sessionPid() !== undefined && /[$#%>] ?$/.test(probe.terminalText());
      });
    },
  };
  return self;
}

/**
 * Dev builds run from `out/`. Setting GLACEON_E2E_EXECUTABLE runs the packaged app instead,
 * with the bare environment Finder gives an app (no LANG, minimal PATH).
 */
function launchOptions(home: string, configDir: string): Parameters<typeof electron.launch>[0] {
  const executablePath = process.env['GLACEON_E2E_EXECUTABLE'];
  const shared = {
    GLACEON_E2E: '1',
    // Windows stay invisible so test runs do not pop up on the developer's screen.
    GLACEON_E2E_HIDDEN: process.env['GLACEON_E2E_VISIBLE'] === '1' ? '0' : '1',
    GLACEON_CONFIG_DIR: configDir,
    HOME: home,
    SHELL: '/bin/sh',
    ENV: '',
  };
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

export interface Fixtures {
  configDir: string;
  /** Settings written to config.json before the app starts. */
  initialSettings: string | undefined;
  app: ElectronApplication;
  window: GlaceonWindow;
}

export const test = base.extend<Fixtures>({
  initialSettings: [undefined, { option: true }],
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern
  configDir: async ({}, use) => {
    const dir = await mkdtemp(join(tmpdir(), 'glaceon-e2e-config-'));
    await use(dir);
    await rm(dir, { recursive: true, force: true });
  },
  app: async ({ configDir, initialSettings }, use) => {
    const home = await mkdtemp(join(tmpdir(), 'glaceon-e2e-'));
    if (initialSettings !== undefined) {
      await writeFile(join(configDir, 'config.json'), initialSettings);
    }
    const app = await electron.launch(launchOptions(home, configDir));
    await use(app);
    await app.close();
    await rm(home, { recursive: true, force: true });
  },
  window: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForFunction(() => '__glaceonE2E' in window);
    const window = wrap(page);
    await window.ready();
    await use(window);
  },
});

/** Runs `action` and returns the window it opens, once its shell is ready. */
export async function newWindowFrom(
  app: ElectronApplication,
  action: () => Promise<void>,
): Promise<GlaceonWindow> {
  const [page] = await Promise.all([app.waitForEvent('window'), action()]);
  await page.waitForFunction(() => '__glaceonE2E' in window);
  const window = wrap(page);
  await window.ready();
  return window;
}

export const isPackagedRun = process.env['GLACEON_E2E_EXECUTABLE'] !== undefined;

export { expect } from '@playwright/test';
