import { join } from 'node:path';
import { E2E_SWITCH, MainInvokeChannel } from '@glaceon/contracts';
import {
  createTerminalWindow,
  PtyHostSupervisor,
  type RendererSource,
} from '@glaceon/infrastructure/main';
import { app, BrowserWindow, ipcMain } from 'electron';

export interface MainCompositionRoot {
  start(): void;
  dispose(): void;
}

function rendererSource(): RendererSource {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  return app.isPackaged || devServerUrl === undefined
    ? { file: join(import.meta.dirname, '../renderer/index.html') }
    : { url: devServerUrl };
}

/** Wires the main process. The only place that knows concrete classes. */
export function createMainCompositionRoot(): MainCompositionRoot {
  const e2e = process.env['GLACEON_E2E'] === '1' || process.argv.includes(E2E_SWITCH);
  const ptyHost = new PtyHostSupervisor({
    modulePath: join(import.meta.dirname, 'pty-host.js'),
    serviceName: 'Glaceon PTY Host',
    onExit: (code) => {
      console.error(`[main] pty host exited with code ${String(code)}`);
    },
  });

  const openWindow = (): void => {
    const window = createTerminalWindow({
      preloadPath: join(import.meta.dirname, '../preload/index.cjs'),
      renderer: rendererSource(),
      e2e,
    });
    const connectionId = String(window.webContents.id);
    window.on('closed', () => {
      ptyHost.disconnect(connectionId);
    });
  };

  return {
    start() {
      ptyHost.start();
      ipcMain.handle(MainInvokeChannel.ptyConnect, (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window === null) throw new Error('pty:connect from an unknown sender');
        ptyHost.connect(event.sender, String(event.sender.id));
      });
      openWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) openWindow();
      });
    },
    dispose() {
      ipcMain.removeHandler(MainInvokeChannel.ptyConnect);
      ptyHost.stop();
    },
  };
}
