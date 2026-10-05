import { CommandIds as C, snippetVariables, type Snippet } from '@glaceon/domain';
import type {
  Command,
  CommandContribution,
  CommandInvocation,
  DynamicCommandProvider,
} from '../command/command';
import type { OverlayService } from '../overlay/overlay-service';
import type { ReadableStore } from '../store/store';

export interface ToolCommandsDeps {
  readonly overlay: OverlayService;
  readonly ring: ReadableStore<readonly string[]>;
  readonly snippets: ReadableStore<readonly Snippet[]>;
  /** Pastes into the active pane. */
  readonly paste: (text: string) => void;
  readonly openSnippetsFile: () => void;
}

/** The clipboard ring (⌘⇧V) and snippets (⌘⇧S), plus a palette entry per snippet. */
export class ToolCommands implements CommandContribution, DynamicCommandProvider {
  readonly #deps: ToolCommandsDeps;

  constructor(deps: ToolCommandsDeps) {
    this.#deps = deps;
  }

  commands(): readonly Command[] {
    const { overlay, ring, paste } = this.#deps;
    return [
      {
        id: C.clipboardShowRing,
        title: 'Paste from Clipboard History…',
        category: 'Edit',
        run: () => overlay.toggle('clipboard'),
      },
      {
        id: C.clipboardPaste,
        title: 'Paste Clipboard History Item',
        category: 'Edit',
        hideInPalette: true,
        run: (args) => {
          const text = typeof args === 'number' ? ring.get()[args] : undefined;
          if (text !== undefined) paste(text);
        },
      },
      {
        id: C.snippetsShow,
        title: 'Insert Snippet…',
        category: 'Snippets',
        run: () => overlay.toggle('snippets'),
      },
      {
        id: C.snippetsInsert,
        title: 'Insert Snippet',
        category: 'Snippets',
        hideInPalette: true,
        run: (args) => {
          this.insert(typeof args === 'string' ? args : '');
        },
      },
      {
        id: C.snippetsOpenFile,
        title: 'Edit Snippets File',
        category: 'Snippets',
        run: () => this.#deps.openSnippetsFile(),
      },
    ];
  }

  /** Pastes a snippet; one with placeholders opens the form that asks for them first. */
  insert(name: string): void {
    const snippet = this.#deps.snippets.get().find((s) => s.name === name);
    if (snippet === undefined) return;
    if (snippetVariables(snippet.body).length === 0) this.#deps.paste(snippet.body);
    else this.#deps.overlay.open('snippets', snippet.name);
  }

  invocations(): readonly CommandInvocation[] {
    return this.#deps.snippets.get().map((snippet) => ({
      id: `snippet:${snippet.name}`,
      title: snippet.name,
      category: 'Snippet',
      command: C.snippetsInsert,
      args: snippet.name,
    }));
  }
}
