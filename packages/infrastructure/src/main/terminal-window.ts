import { E2E_SWITCH, RendererChannel } from '@glaceon/contracts';
import { BrowserWindow } from 'electron';
import { hardenWebContents } from './web-contents-hardening';

export type RendererSource = { readonly url: string } | { readonly file: string };

export interface TerminalWindowOptions {
  readonly preloadPath: string;
  readonly renderer: RendererSource;
  readonly e2e: boolean;
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
    window.once('ready-to-show', () => {
      window.show();
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

  /** Closes without asking the renderer (it already confirmed, or the app is quitting). */
  forceClose(): void {
    this.#closeApproved = true;
    this.browserWindow.close();
  }

  approveClose(): void {
    this.#closeApproved = true;
  }
}
