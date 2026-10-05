import { E2E_SWITCH } from '@glaceon/contracts';
import { BrowserWindow } from 'electron';
import { hardenWebContents } from './web-contents-hardening';

export type RendererSource = { readonly url: string } | { readonly file: string };

export interface TerminalWindowOptions {
  readonly preloadPath: string;
  readonly renderer: RendererSource;
  readonly e2e: boolean;
}

/** A frameless-looking, vibrant terminal window with a sandboxed, isolated renderer. */
export function createTerminalWindow(options: TerminalWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 480,
    minHeight: 320,
    show: false,
    title: 'Glaceon Terminal',
    titleBarStyle: 'hiddenInset',
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
  hardenWebContents(window.webContents);
  window.once('ready-to-show', () => {
    window.show();
  });

  if ('url' in options.renderer) {
    void window.loadURL(options.renderer.url);
  } else {
    void window.loadFile(options.renderer.file);
  }
  return window;
}
