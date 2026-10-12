import {
  computed,
  QuakeController,
  type GlobalShortcutPort,
  type QuakePanel,
  type ReadableStore,
} from '@glaceon/application';
import type { SettingsSnapshot } from '@glaceon/contracts';
import { toElectronAccelerator, type TerminalWindow } from '@glaceon/infrastructure/main';
import { app, BrowserWindow, globalShortcut, screen } from 'electron';

export interface QuakeOptions {
  readonly settings: ReadableStore<SettingsSnapshot>;
  readonly openWindow: () => TerminalWindow;
  /**
   * Keep the window ready while the shortcut is on (off under e2e, where tests create it on
   * demand). It holds a renderer, a shell and a WebGL context, so it goes when turned off.
   */
  readonly prewarm: boolean;
  /** E2E: invisible window, and shortcuts that never reach the real system. */
  readonly hidden: boolean;
}

/** Shortcuts kept in memory, so test runs never take over the user's keys. */
class InMemoryShortcuts implements GlobalShortcutPort {
  readonly owned = new Map<string, () => void>();
  register(accelerator: string, callback: () => void): boolean {
    this.owned.set(accelerator, callback);
    return true;
  }
  unregister(accelerator: string): void {
    this.owned.delete(accelerator);
  }
}

const systemShortcuts: GlobalShortcutPort = {
  register: (accelerator, callback) => {
    try {
      return globalShortcut.register(accelerator, callback);
    } catch {
      return false;
    }
  },
  unregister: (accelerator) => {
    globalShortcut.unregister(accelerator);
  },
};

/** Wires the drop-down window: Electron adapters around the application's QuakeController. */
export function createQuake(options: QuakeOptions): QuakeController {
  let window: TerminalWindow | undefined;
  // Under e2e the window is invisible, so "focused" follows "visible".
  let shown = false;
  const enabled = (): boolean => options.settings.get().settings.quakeEnabled;

  const ensureWindow = (): TerminalWindow => {
    if (window !== undefined && !window.browserWindow.isDestroyed()) return window;
    const created = options.openWindow();
    window = created;
    created.browserWindow.on('blur', () => {
      controller.blurred();
    });
    created.browserWindow.on('closed', () => {
      if (window === created) window = undefined;
      shown = false;
      // Closing its last tab closes the window; have the next one ready.
      if (options.prewarm && enabled()) setImmediate(ensureWindow);
    });
    return created;
  };

  const panel = (): QuakePanel => {
    const target = ensureWindow().browserWindow;
    return {
      get visible() {
        return shown && target.isVisible();
      },
      get focused() {
        return options.hidden ? shown : target.isFocused();
      },
      show: (bounds) => {
        shown = true;
        target.setBounds(bounds);
        if (options.hidden) {
          target.setOpacity(0);
          target.showInactive();
        } else {
          target.show();
          target.focus();
        }
      },
      hide: () => {
        shown = false;
        target.hide();
        // Turned off while it was down: nothing can bring it back.
        if (!enabled()) window?.forceClose();
      },
    };
  };

  const shortcuts = options.hidden ? new InMemoryShortcuts() : systemShortcuts;
  const controller = new QuakeController({
    panel,
    screen: {
      workAreaAtPointer: () =>
        screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea,
    },
    shortcuts,
    activation: {
      isActive: () => BrowserWindow.getFocusedWindow() !== null,
      yieldFocus: () => {
        app.hide();
      },
    },
    settings: computed([options.settings], () => options.settings.get().settings),
    toAccelerator: toElectronAccelerator,
  });

  if (options.hidden) {
    // Test hook: Playwright's app.evaluate() drives the quake window through this.
    Object.assign(globalThis, {
      __glaceonQuake: {
        press: () => {
          for (const callback of (shortcuts as InMemoryShortcuts).owned.values()) callback();
        },
        status: () => controller.status.get(),
        visible: () => panel().visible,
        bounds: () => window?.browserWindow.getBounds(),
        workArea: () => screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea,
      },
    });
  }
  const prewarm = (): void => {
    if (enabled()) {
      if (options.prewarm) ensureWindow();
    } else if (window !== undefined && !shown) {
      window.forceClose();
    }
  };
  prewarm();
  options.settings.subscribe(prewarm);
  return controller;
}
