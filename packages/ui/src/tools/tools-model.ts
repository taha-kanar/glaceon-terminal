import type { ReadableStore } from '@glaceon/application';
import type { Snippet } from '@glaceon/domain';

export interface SnippetsView {
  readonly snippets: readonly Snippet[];
  /** Why snippets.json could not be read (the last good snippets stay usable). */
  readonly problem?: string;
}

export interface ToolsModel {
  /** Clipboard history, newest first. */
  readonly ring: ReadableStore<readonly string[]>;
  readonly snippets: ReadableStore<SnippetsView>;
  /** Pastes into the active pane (and closes the picker). */
  readonly paste: (text: string) => void;
  readonly openSnippetsFile: () => void;
}
