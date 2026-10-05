import { CommandIds as C } from '@glaceon/domain';
import type { Command, CommandContribution } from '../command/command';

export interface EditCommandsDeps {
  /** Copies the active pane's selection, if any. */
  readonly copy: () => void;
  /** Pastes the clipboard into the active pane. */
  readonly paste: () => Promise<void>;
  readonly selectAll: () => void;
}

/**
 * Copy, paste and select all for menus and the palette. ⌘C/⌘V stay with the native Edit menu
 * roles, so these have no default keybindings.
 */
export class EditCommands implements CommandContribution {
  readonly #deps: EditCommandsDeps;

  constructor(deps: EditCommandsDeps) {
    this.#deps = deps;
  }

  commands(): readonly Command[] {
    const { copy, paste, selectAll } = this.#deps;
    return [
      { id: C.terminalCopy, title: 'Copy', category: 'Edit', run: copy },
      { id: C.terminalPaste, title: 'Paste', category: 'Edit', run: () => paste() },
      { id: C.terminalSelectAll, title: 'Select All', category: 'Edit', run: selectAll },
    ];
  }
}
