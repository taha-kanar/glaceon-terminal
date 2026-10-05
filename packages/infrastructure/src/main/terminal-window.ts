import { E2E_SWITCH, RendererChannel } from '@glaceon/contracts';
import { BrowserWindow } from 'electron';
import { hardenWebContents } from './web-contents-hardening';

export type RendererSource = { readonly url: string } | { readonly file: string };

export interface TerminalWindowOptions {
  readonly preloadPath: string;
  readonly renderer: RendererSource;
  readonly e2e: boolean;
  /** Never visible on screen (fully transparent, never focused): for automated tests. */
  readonly hidden?: boolean;
  /** Top-left corner on screen; the system places the window when omitted. */
  readonly position?: { readonly x: number; readonly y: number };
}

/**
 * A vibrant terminal window with a sandboxed, isolated renderer. Closing it from the title bar
 * asks the renderer first (it may confirm running processes); `forceClose` skips that.
 */
export class TerminalWindow {
  readonly browserWindow: BrowserWindow;
  #closeApproved = false;

  constructor(options: TerminalWindowOptions) {
    const window = new BrowserWindow({
      width: 1100,
      height: 720,
      ...(options.position === undefined
        ? {}
        : { x: Math.round(options.position.x), y: Math.round(options.position.y) }),
      minWidth: 480,
      minHeight: 320,
      show: false,
      title: 'Glaceon Terminal',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 12 },
      vibrancy: 'under-window',
      visualEffectState: 'active',
      backgroundColor: '#00000000',
      webPreferences: {
        preload: options.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webviewTag: false,
        spellcheck: false,
        additionalArguments: options.e2e ? [E2E_SWITCH] : [],
      },
    });
    this.browserWindow = window;
    hardenWebContents(window.webContents);
    // Under e2e tests the real cursor must not interfere with synthetic (CDP) pointer input.
    if (options.e2e) window.setIgnoreMouseEvents(true);
    window.once('ready-to-show', () => {
      if (options.hidden === true) {
        // Still rendered (so tests can drive it), but invisible and never stealing focus.
        window.setOpacity(0);
        window.showInactive();
      } else {
        window.show();
      }
    });
    window.on('close', (event) => {
      if (this.#closeApproved || window.webContents.isCrashed()) return;
      event.preventDefault();
      window.webContents.send(RendererChannel.closeRequested);
    });

    if ('url' in options.renderer) {
      void window.loadURL(options.renderer.url);
    } else {
      void window.loadFile(options.renderer.file);
    }
  }

  get id(): number {
    return this.browserWindow.webContents.id;
  }

  contains(point: { readonly x: number; readonly y: number }): boolean {
    const { x, y, width, height } = this.browserWindow.getBounds();
    return point.x >= x && point.x < x + width && point.y >= y && point.y < y + height;
  }

  /** Closes without asking the renderer (it already confirmed, or the app is quitting). */
  forceClose(): void {
    this.#closeApproved = true;
    this.browserWindow.close();
  }

  approveClose(): void {
    this.#closeApproved = true;
  }
}
