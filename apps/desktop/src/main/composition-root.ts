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
  type SettingsUpdateResult,
  decodeSettingsUpdateRequest,
  decodeLinkOpenRequest,
  decodeTabImportResult,
  type OperationResult,
} from '@glaceon/contracts';
import { CommandIds, type Settings } from '@glaceon/domain';
import {
  buildApplicationMenu,
  EditorLauncher,
  SystemLinkOpener,
  JsoncSettingsSource,
  decodeTabTransferRequest,
  TabTransferCoordinator,
  type TransferWindow,
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
  const hidden = e2e && process.env['GLACEON_E2E_HIDDEN'] === '1';
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
  const links = new SystemLinkOpener({
    home: homedir(),
    editorCommand: () => settings.state.get().settings.editorCommand,
    editor: new EditorLauncher({ shell: process.env['SHELL'] ?? '/bin/zsh' }),
    openExternal: (url) => shell.openExternal(url),
    openPath: (path) => shell.openPath(path),
  });

  const broadcastWindows = (): void => {
    for (const window of windows.values()) {
      window.browserWindow.webContents.send(
        RendererChannel.windowsChanged,
        transfers.summaries(window.id),
      );
    }
  };

  const openWindow = (at?: { readonly x: number; readonly y: number }): TerminalWindow => {
    const window = new TerminalWindow({
      preloadPath: join(import.meta.dirname, '../preload/index.cjs'),
      renderer: rendererSource(),
      e2e,
      hidden,
      // A torn-off tab's window appears under the pointer, title bar first.
      ...(at === undefined ? {} : { position: { x: at.x - 160, y: at.y - 16 } }),
    });
    const id = window.id;
    windows.set(id, window);
    window.browserWindow.on('closed', () => {
      windows.delete(id);
      ptyHost.disconnect(String(id));
      transfers.closed(id);
      broadcastWindows();
    });
    return window;
  };

  const asTransferWindow = (window: TerminalWindow): TransferWindow => ({
    id: window.id,
    contains: (point) => window.contains(point),
    importTab: (request) => {
      window.browserWindow.webContents.send(RendererChannel.tabImport, request);
    },
    focus: () => {
      window.browserWindow.focus();
    },
  });

  const transfers = new TabTransferCoordinator({
    windows: () => [...windows.values()].map(asTransferWindow),
    openWindow: (at) => asTransferWindow(openWindow(at)),
    setTimeout: (callback, ms) => {
      const timer = setTimeout(callback, ms);
      return { dispose: () => clearTimeout(timer) };
    },
    timeoutMs: Number(process.env['GLACEON_TRANSFER_TIMEOUT_MS'] ?? 15_000),
  });

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
    ipcMain.handle(
      MainInvokeChannel.linkOpen,
      async (_event, payload: unknown): Promise<OperationResult> => {
        const request = decodeLinkOpenRequest(payload);
        if (request === undefined) return { ok: false, error: 'Malformed link' };
        const result =
          request.kind === 'url' ? await links.openUrl(request.url) : await links.openFile(request);
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      },
    );
    ipcMain.handle(
      MainInvokeChannel.settingsUpdate,
      async (_event, payload: unknown): Promise<SettingsUpdateResult> => {
        const request = decodeSettingsUpdateRequest(payload);
        if (request === undefined) return { ok: false, error: 'Malformed settings update' };
        // The value is validated against the schema by the settings source before writing.
        const result = await settings.update(request.key as keyof Settings, request.value as never);
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      },
    );
    ipcMain.handle(MainInvokeChannel.tabTransfer, (event, payload: unknown) => {
      const request = decodeTabTransferRequest(payload);
      return request === undefined ? false : transfers.transfer(windowOf(event).id, request);
    });
    ipcMain.handle(MainInvokeChannel.windowReady, (event) => {
      const ready = transfers.ready(windowOf(event).id);
      // Imports go out after the reply, so the renderer knows not to open a tab of its own.
      setImmediate(ready.flush);
      broadcastWindows();
      return ready.pending;
    });
    ipcMain.on(MainSendChannel.tabImportResult, (event, payload: unknown) => {
      const result = decodeTabImportResult(payload);
      if (result !== undefined) transfers.result(windowOf(event).id, result);
    });
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
      if (hidden) app.dock?.hide();
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
