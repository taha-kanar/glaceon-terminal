import { CommandIds as C, type KeyChord } from '@glaceon/domain';
import { Menu, type MenuItemConstructorOptions } from 'electron';
import { toElectronAccelerator } from './accelerator';

export interface MenuCommand {
  readonly label: string;
  readonly command: string;
  readonly args?: string | number;
}

export interface ApplicationMenuOptions {
  readonly appName: string;
  readonly isDevelopment: boolean;
  /** The keybinding shown next to a command. */
  readonly chordFor: (command: string, args?: string | number) => KeyChord | undefined;
  readonly run: (command: string, args?: string | number) => void;
}

const SHELL_MENU: readonly (MenuCommand | 'separator')[] = [
  { label: 'New Tab', command: C.tabNew },
  { label: 'New Window', command: C.windowNew },
  'separator',
  { label: 'Split Right', command: C.paneSplitRight },
  { label: 'Split Down', command: C.paneSplitDown },
  'separator',
  { label: 'Close Pane', command: C.paneClose },
  { label: 'Close Tab', command: C.tabClose },
  { label: 'Close Window', command: C.windowClose },
];

const VIEW_MENU: readonly (MenuCommand | 'separator')[] = [
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

/**
 * The macOS menu bar. Command accelerators are labels only (`registerAccelerator: false`):
 * the renderer's keybinding service handles the keys, so user remaps work and nothing fires twice.
 * Clipboard and app items keep their native roles.
 */
export function buildApplicationMenu(options: ApplicationMenuOptions): Menu {
  const item = (entry: MenuCommand | 'separator'): MenuItemConstructorOptions => {
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
  const template: MenuItemConstructorOptions[] = [
    {
      label: options.appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        item({ label: 'Settings…', command: C.settingsOpen }),
        item({ label: 'Open Settings File', command: C.settingsOpenFile }),
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
      ],
    },
    {
      label: 'View',
      submenu: [
        ...VIEW_MENU.map(item),
        ...(options.isDevelopment
          ? [
              { type: 'separator' as const },
              { role: 'toggleDevTools' as const },
              { role: 'reload' as const },
            ]
          : []),
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  return Menu.buildFromTemplate(template);
}
