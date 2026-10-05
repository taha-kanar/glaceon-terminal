import { CommandIds } from '../command/command-ids';

/** One binding as written in config.json. A `command` prefixed with `-` removes bindings. */
export interface KeybindingEntry {
  readonly key: string;
  readonly command: string;
  readonly when?: string;
  readonly args?: string | number;
}

const C = CommandIds;

const tabSelect = Array.from({ length: 9 }, (_, i): KeybindingEntry => ({
  key: `cmd+${String(i + 1)}`,
  command: C.tabSelect,
  args: i + 1,
}));

export const DEFAULT_KEYBINDINGS: readonly KeybindingEntry[] = [
  { key: 'cmd+t', command: C.tabNew },
  { key: 'cmd+alt+w', command: C.tabClose },
  { key: 'cmd+shift+]', command: C.tabNext },
  { key: 'cmd+shift+[', command: C.tabPrevious },
  { key: 'ctrl+tab', command: C.tabNext },
  { key: 'ctrl+shift+tab', command: C.tabPrevious },
  ...tabSelect,
  { key: 'cmd+n', command: C.windowNew },
  { key: 'cmd+shift+w', command: C.windowClose },
  { key: 'cmd+d', command: C.paneSplitRight },
  { key: 'cmd+shift+d', command: C.paneSplitDown },
  { key: 'cmd+w', command: C.paneClose },
  { key: 'cmd+alt+left', command: C.paneFocusLeft },
  { key: 'cmd+alt+right', command: C.paneFocusRight },
  { key: 'cmd+alt+up', command: C.paneFocusUp },
  { key: 'cmd+alt+down', command: C.paneFocusDown },
  { key: 'cmd+]', command: C.paneFocusNext },
  { key: 'cmd+[', command: C.paneFocusPrevious },
  { key: 'cmd+shift+enter', command: C.paneToggleZoom },
  { key: 'cmd+ctrl+=', command: C.paneEqualize },
  { key: 'cmd+ctrl+left', command: C.paneResizeLeft },
  { key: 'cmd+ctrl+right', command: C.paneResizeRight },
  { key: 'cmd+ctrl+up', command: C.paneResizeUp },
  { key: 'cmd+ctrl+down', command: C.paneResizeDown },
  { key: 'cmd+k', command: C.terminalClear, when: 'terminalFocus' },
  { key: 'cmd+=', command: C.fontIncrease },
  { key: 'cmd+shift+=', command: C.fontIncrease },
  { key: 'cmd+-', command: C.fontDecrease },
  { key: 'cmd+0', command: C.fontReset },
  { key: 'cmd+,', command: C.settingsOpen },
];
