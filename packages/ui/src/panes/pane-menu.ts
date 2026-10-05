import { CommandIds as C } from '@glaceon/domain';
import type { MenuEntry } from '../menu/ContextMenu';

const ITEMS: readonly (readonly [label: string, command: string] | 'separator')[] = [
  ['Copy', C.terminalCopy],
  ['Paste', C.terminalPaste],
  ['Select All', C.terminalSelectAll],
  'separator',
  ['Find…', C.searchOpen],
  ['Clear', C.terminalClear],
  'separator',
  ['Split Right', C.paneSplitRight],
  ['Split Down', C.paneSplitDown],
  ['Zoom Pane', C.paneToggleZoom],
  ['Move Pane to New Tab', C.paneMoveToNewTab],
  'separator',
  ['Close Pane', C.paneClose],
];

/** The terminal's right-click menu; every entry runs a command on the (just focused) pane. */
export function paneMenu(runCommand: (command: string) => void): readonly MenuEntry[] {
  return ITEMS.map((item) =>
    item === 'separator'
      ? { kind: 'separator' }
      : {
          kind: 'item',
          label: item[0],
          onSelect: () => {
            runCommand(item[1]);
          },
        },
  );
}
