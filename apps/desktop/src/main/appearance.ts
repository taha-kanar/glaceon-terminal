import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ReadableStore, SettingsState } from '@glaceon/application';
import { MainInvokeChannel } from '@glaceon/contracts';
import {
  BACKGROUND_IMAGE_EXTENSIONS,
  registerBackgroundImageScheme,
  resolveBackgroundImage,
  serveBackgroundImage,
  type TerminalWindow,
} from '@glaceon/infrastructure/main';
import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron';

/** Must run before the app is ready. */
export function prepareWindowAppearance(): void {
  registerBackgroundImageScheme();
}

export function installAboutPanel(): void {
  app.setAboutPanelOptions({
    applicationName: app.name,
    applicationVersion: app.getVersion(),
    version: `Electron ${process.versions.electron}`,
    copyright: '© 2026 Taha Kanar',
    credits: 'Built with xterm.js, node-pty, React and Electron.',
  });
  // Packaged builds take the icon from the bundle; dev runs would show Electron's.
  if (!app.isPackaged) app.dock?.setIcon(join(import.meta.dirname, '../../build/icon.png'));
}

/**
 * Window background: serves the background image, offers a picker for it, and turns frosted
 * glass (vibrancy) on and off as the setting changes.
 */
export function installWindowAppearance(options: {
  readonly settings: ReadableStore<SettingsState>;
  readonly windows: () => Iterable<TerminalWindow>;
}): void {
  const current = (): SettingsState['settings'] => options.settings.get().settings;
  // Vibrancy follows the system appearance; in light mode it would turn the window white.
  nativeTheme.themeSource = 'dark';
  serveBackgroundImage(() => resolveBackgroundImage(current().backgroundImage, homedir()));

  ipcMain.handle(MainInvokeChannel.backgroundChooseImage, async (event) => {
    const dialogOptions = {
      title: 'Choose a background image',
      properties: ['openFile' as const],
      filters: [{ name: 'Images', extensions: BACKGROUND_IMAGE_EXTENSIONS }],
    };
    const parent = BrowserWindow.fromWebContents(event.sender);
    const result = await (parent === null
      ? dialog.showOpenDialog(dialogOptions)
      : dialog.showOpenDialog(parent, dialogOptions));
    return result.canceled ? undefined : result.filePaths[0];
  });

  let blur = current().backgroundBlur;
  options.settings.subscribe(() => {
    if (current().backgroundBlur === blur) return;
    blur = current().backgroundBlur;
    for (const window of options.windows()) window.setBlur(blur);
  });
}
