import {
  EditCommands,
  ObservableStore,
  ToolCommands,
  computed,
  type OverlayService,
  type ReadableStore,
  type SessionManager,
  type WorkspaceService,
} from '@glaceon/application';
import type { GlaceonBridge, SnippetsSnapshot } from '@glaceon/contracts';
import type { Settings } from '@glaceon/domain';
import type { XtermViewRegistry } from '@glaceon/infrastructure/renderer';
import type { ToolsModel } from '@glaceon/ui';

export interface RendererTools {
  readonly model: ToolsModel;
  readonly commands: ToolCommands;
  readonly edit: EditCommands;
}

/**
 * Snippets and the clipboard ring live in main (one file watcher and one clipboard poller for
 * all windows); a window mirrors them and pastes into its active pane.
 */
export async function createRendererTools(parts: {
  readonly bridge: GlaceonBridge;
  readonly overlay: OverlayService;
  readonly sessions: SessionManager;
  readonly workspace: WorkspaceService;
  readonly views: XtermViewRegistry;
  readonly settings: ReadableStore<Settings>;
}): Promise<RendererTools> {
  const { bridge, overlay, sessions, workspace } = parts;
  const [snippetsSnapshot, ringSnapshot] = await Promise.all([
    bridge.getSnippets(),
    bridge.getClipboardRing(),
  ]);
  const snippets = new ObservableStore<SnippetsSnapshot>(snippetsSnapshot);
  bridge.onSnippetsChanged((next) => {
    snippets.set(next);
  });
  const ring = new ObservableStore<readonly string[]>(ringSnapshot);
  bridge.onClipboardRingChanged((next) => {
    ring.set(next);
  });
  parts.views.onSelection(({ text }) => {
    if (parts.settings.get().copyOnSelect) bridge.writeClipboard(text);
  });

  const paste = (text: string): void => {
    overlay.close();
    const pane = workspace.activePane;
    if (pane === undefined) return;
    sessions.paste(pane, text);
    sessions.focus(pane);
  };
  const openSnippetsFile = (): void => {
    overlay.close();
    bridge.openSnippetsFile();
  };
  const commands = new ToolCommands({
    overlay,
    ring,
    snippets: computed([snippets], () => snippets.get().snippets),
    paste,
    openSnippetsFile,
  });
  const activeView = () => {
    const pane = workspace.activePane;
    return pane === undefined ? undefined : parts.views.get(pane);
  };
  const edit = new EditCommands({
    copy: () => {
      const text = activeView()?.selectionText() ?? '';
      if (text !== '') bridge.writeClipboard(text);
    },
    paste: async () => {
      const text = await bridge.readClipboard();
      if (text !== '') paste(text);
    },
    selectAll: () => {
      activeView()?.selectAll();
    },
  });
  return {
    model: { ring, snippets, paste, openSnippetsFile },
    commands,
    edit,
  };
}
