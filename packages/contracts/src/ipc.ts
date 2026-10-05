/** invoke() channels handled by the main process (renderer → main, with a reply). */
export const MainInvokeChannel = {
  ptyConnect: 'pty:connect',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  linkOpen: 'link:open',
  /** Move a tab to another (or a new) window; resolves once the target adopted it. */
  tabTransfer: 'tab:transfer',
  /** The renderer is wired up; replies how many tabs are waiting to be imported. */
  windowReady: 'window:ready',
  snippetsGet: 'snippets:get',
  clipboardRingGet: 'clipboard:ring',
  clipboardRead: 'clipboard:read',
  /** Shows an open dialog for a background image; replies with its path or undefined. */
  backgroundChooseImage: 'background:choose-image',
} as const;

/** send() channels handled by the main process (renderer → main, fire and forget). */
export const MainSendChannel = {
  windowNew: 'window:new',
  windowClose: 'window:close',
  settingsOpenFile: 'settings:open-file',
  tabImportResult: 'tab:import-result',
  snippetsOpenFile: 'snippets:open-file',
  clipboardWrite: 'clipboard:write',
} as const;

/** Channels main pushes to renderers. */
export const RendererChannel = {
  settingsChanged: 'settings:changed',
  /** A menu item (or main) asks the renderer to run a command. */
  runCommand: 'command:run',
  /** The user clicked the window's close button; the renderer decides (it may confirm first). */
  closeRequested: 'window:close-requested',
  /** A tab moved here from another window. */
  tabImport: 'tab:import',
  windowsChanged: 'windows:changed',
  snippetsChanged: 'snippets:changed',
  clipboardRingChanged: 'clipboard:ring-changed',
} as const;

/** Channel on which main delivers a window's pty MessagePort to its preload. */
export const PTY_PORT_IPC_CHANNEL = 'pty:port';

/** window.postMessage type used by the preload to hand the port to the page. */
export const PTY_PORT_WINDOW_MESSAGE = 'glaceon:pty-port';
