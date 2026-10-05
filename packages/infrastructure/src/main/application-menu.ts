import { CommandIds as C, type KeyChord } from '@glaceon/domain';
import { Menu, type MenuItemConstructorOptions } from 'electron';
import { toElectronAccelerator } from './accelerator';

export interface MenuCommand {
  readonly label: string;
  readonly command: string;
  readonly args?: string | number;
}

type MenuEntry = MenuCommand | 'separator';

export interface ApplicationMenuOptions {
  readonly appName: string;
  readonly isDevelopment: boolean;
  /** The keybinding shown next to a command. */
  readonly chordFor: (command: string, args?: string | number) => KeyChord | undefined;
  readonly run: (command: string, args?: string | number) => void;
}

const APP_MENU: readonly MenuEntry[] = [
  { label: 'Settings…', command: C.settingsOpen },
  { label: 'Open Settings File', command: C.settingsOpenFile },
  { label: 'Open Snippets File', command: C.snippetsOpenFile },
];

const SHELL_MENU: readonly MenuEntry[] = [
  { label: 'New Tab', command: C.tabNew },
  { label: 'New Window', command: C.windowNew },
  'separator',
  { label: 'Split Right', command: C.paneSplitRight },
  { label: 'Split Down', command: C.paneSplitDown },
  'separator',
  { label: 'Rename Tab…', command: C.tabRename },
  { label: 'Pin / Unpin Tab', command: C.tabTogglePin },
  { label: 'Lock / Unlock Tab', command: C.tabToggleLock },
  { label: 'Move Pane to New Tab', command: C.paneMoveToNewTab },
  { label: 'Move Tab to New Window', command: C.tabMoveToNewWindow },
  'separator',
  { label: 'Close Pane', command: C.paneClose },
  { label: 'Close Tab', command: C.tabClose },
  { label: 'Close Window', command: C.windowClose },
];

const EDIT_TOOLS: readonly MenuEntry[] = [
  { label: 'Find…', command: C.searchOpen },
  { label: 'Find Next', command: C.searchNext },
  { label: 'Find Previous', command: C.searchPrevious },
  'separator',
  { label: 'Clipboard History…', command: C.clipboardShowRing },
  { label: 'Snippets…', command: C.snippetsShow },
];

const VIEW_MENU: readonly MenuEntry[] = [
  { label: 'Command Palette…', command: C.paletteToggle },
  { label: 'Job Tracker', command: C.jobsToggle },
  'separator',
  { label: 'Select Theme…', command: C.themeSelect },
  { label: 'Edit Theme…', command: C.themeEdit },
  'separator',
  { label: 'Toggle Pane Zoom', command: C.paneToggleZoom },
  { label: 'Equalize Panes', command: C.paneEqualize },
  'separator',
  { label: 'Next Pane', command: C.paneFocusNext },
  { label: 'Previous Pane', command: C.paneFocusPrevious },
  { label: 'Next Tab', command: C.tabNext },
  { label: 'Previous Tab', command: C.tabPrevious },
  'separator',
  { label: 'Bigger', command: C.fontIncrease },
  { label: 'Smaller', command: C.fontDecrease },
  { label: 'Actual Size', command: C.fontReset },
  'separator',
  { label: 'Clear Terminal', command: C.terminalClear },
];

/** Every command the menu bar can run (exported for tests). */
export const MENU_COMMANDS: readonly MenuCommand[] = [
  ...APP_MENU,
  ...SHELL_MENU,
  ...EDIT_TOOLS,
  ...VIEW_MENU,
].filter((entry): entry is MenuCommand => entry !== 'separator');

/**
 * The menu bar template. Command accelerators are labels only (`registerAccelerator: false`):
 * the renderer's keybinding service handles the keys, so user remaps work and nothing fires twice.
 * Clipboard and app items keep their native roles.
 */
export function applicationMenuTemplate(
  options: ApplicationMenuOptions,
): MenuItemConstructorOptions[] {
  const item = (entry: MenuEntry): MenuItemConstructorOptions => {
    if (entry === 'separator') return { type: 'separator' };
    const chord = options.chordFor(entry.command, entry.args);
    return {
      label: entry.label,
      ...(chord === undefined ? {} : { accelerator: toElectronAccelerator(chord) }),
      registerAccelerator: false,
      click: () => {
        options.run(entry.command, entry.args);
      },
    };
  };
  const developer: MenuItemConstructorOptions[] = options.isDevelopment
    ? [{ type: 'separator' }, { role: 'toggleDevTools' }, { role: 'reload' }]
    : [];
  return [
    {
      label: options.appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        ...APP_MENU.map(item),
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: 'Shell', submenu: SHELL_MENU.map(item) },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        ...EDIT_TOOLS.map(item),
      ],
    },
    {
      label: 'View',
      submenu: [
        ...VIEW_MENU.map(item),
        ...developer,
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    { role: 'help', submenu: [] },
  ];
}

export function buildApplicationMenu(options: ApplicationMenuOptions): Menu {
  return Menu.buildFromTemplate(applicationMenuTemplate(options));
}
