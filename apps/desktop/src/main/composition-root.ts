import { homedir } from 'node:os';
import { join } from 'node:path';
import { KeybindingResolver, SettingsService } from '@glaceon/application';
import {
  E2E_SWITCH,
  MainInvokeChannel,
  MainSendChannel,
  RendererChannel,
  type RunCommandRequest,
  type SettingsSnapshot,
} from '@glaceon/contracts';
import { CommandIds } from '@glaceon/domain';
import {
  buildApplicationMenu,
  JsoncSettingsSource,
  PtyHostSupervisor,
  TerminalWindow,
  type RendererSource,
} from '@glaceon/infrastructure/main';
import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainEvent } from 'electron';

export interface MainCompositionRoot {
  start(): Promise<void>;
  dispose(): void;
}

function rendererSource(): RendererSource {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  return app.isPackaged || devServerUrl === undefined
    ? { file: join(import.meta.dirname, '../renderer/index.html') }
    : { url: devServerUrl };
}

function configDirectory(): string {
  return process.env['GLACEON_CONFIG_DIR'] ?? join(homedir(), '.config', 'glaceon');
}

/** Wires the main process. The only place that knows concrete classes. */
export function createMainCompositionRoot(): MainCompositionRoot {
  const e2e = process.env['GLACEON_E2E'] === '1' || process.argv.includes(E2E_SWITCH);
  const windows = new Map<number, TerminalWindow>();
  const settingsSource = new JsoncSettingsSource({ path: join(configDirectory(), 'config.json') });
  const settings = new SettingsService(settingsSource);
  const ptyHost = new PtyHostSupervisor({
    modulePath: join(import.meta.dirname, 'pty-host.js'),
    serviceName: 'Glaceon PTY Host',
    onExit: (code) => {
      console.error(`[main] pty host exited with code ${String(code)}`);
    },
  });

  const snapshot = (): SettingsSnapshot => settings.state.get();

  const openWindow = (): void => {
    const window = new TerminalWindow({
      preloadPath: join(import.meta.dirname, '../preload/index.cjs'),
      renderer: rendererSource(),
      e2e,
    });
    const id = window.id;
    windows.set(id, window);
    window.browserWindow.on('closed', () => {
      windows.delete(id);
      ptyHost.disconnect(String(id));
    });
  };

  const windowOf = (event: IpcMainEvent | Electron.IpcMainInvokeEvent): TerminalWindow => {
    const window = windows.get(event.sender.id);
    if (window === undefined) throw new Error('IPC from an unknown sender');
    return window;
  };

  const runCommand = (command: string, args?: string | number): void => {
    const focused = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (focused === undefined) {
      if (command === CommandIds.windowNew || command === CommandIds.tabNew) openWindow();
      return;
    }
    const request: RunCommandRequest = args === undefined ? { command } : { command, args };
    focused.webContents.send(RendererChannel.runCommand, request);
  };

  const installMenu = (): void => {
    const resolver = new KeybindingResolver(settings.state.get().settings.keybindings);
    Menu.setApplicationMenu(
      buildApplicationMenu({
        appName: app.name,
        isDevelopment: !app.isPackaged,
        chordFor: (command, args) => resolver.chordFor(command, args),
        run: runCommand,
      }),
    );
  };

  const registerIpc = (): void => {
    ipcMain.handle(MainInvokeChannel.ptyConnect, (event) => {
      const window = windowOf(event);
      ptyHost.connect(event.sender, String(window.id));
    });
    ipcMain.handle(MainInvokeChannel.settingsGet, () => snapshot());
    ipcMain.on(MainSendChannel.windowNew, () => {
      openWindow();
    });
    ipcMain.on(MainSendChannel.windowClose, (event) => {
      windowOf(event).forceClose();
    });
    ipcMain.on(MainSendChannel.settingsOpenFile, () => {
      void shell.openPath(settingsSource.path);
    });
  };

  return {
    async start() {
      ptyHost.start();
      await settingsSource.ensureExists().catch((error: unknown) => {
        console.error('[main] cannot create settings file', error);
      });
      await settings.start();
      settings.state.subscribe(() => {
        installMenu();
        for (const window of windows.values()) {
          window.browserWindow.webContents.send(RendererChannel.settingsChanged, snapshot());
        }
      });
      installMenu();
      registerIpc();
      openWindow();
      app.on('activate', () => {
        if (windows.size === 0) openWindow();
      });
      app.on('before-quit', () => {
        for (const window of windows.values()) window.approveClose();
      });
    },
    dispose() {
      for (const channel of Object.values(MainInvokeChannel)) ipcMain.removeHandler(channel);
      for (const channel of Object.values(MainSendChannel)) ipcMain.removeAllListeners(channel);
      settings.dispose();
      ptyHost.stop();
    },
  };
}
