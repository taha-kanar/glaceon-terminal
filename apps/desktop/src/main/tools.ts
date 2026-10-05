import { ClipboardRingService, SnippetLibrary } from '@glaceon/application';
import { MainInvokeChannel, MainSendChannel, RendererChannel } from '@glaceon/contracts';
import { JsoncSnippetSource, MemoryClipboard, SystemClipboard } from '@glaceon/infrastructure/main';
import { ipcMain, shell } from 'electron';
import { join } from 'node:path';

const MAX_CLIP_BYTES = 16 * 1024 * 1024;

export interface Tools {
  start(broadcast: (channel: string, payload: () => unknown) => void): Promise<void>;
  dispose(): void;
}

/** Snippets (snippets.json) and the clipboard ring, shared by every window. */
export function createTools(options: {
  readonly configDirectory: string;
  readonly e2e: boolean;
}): Tools {
  const source = new JsoncSnippetSource(join(options.configDirectory, 'snippets.json'));
  const snippets = new SnippetLibrary(source);
  const clipboardRing = new ClipboardRingService({
    // Tests never touch the user's real clipboard.
    clipboard: options.e2e ? new MemoryClipboard() : new SystemClipboard(),
    scheduler: {
      setTimeout: (callback, ms) => {
        const timer = setTimeout(callback, ms);
        return { dispose: () => clearTimeout(timer) };
      },
      setInterval: (callback, ms) => {
        const timer = setInterval(callback, ms);
        return { dispose: () => clearInterval(timer) };
      },
    },
  });

  return {
    async start(broadcast) {
      ipcMain.handle(MainInvokeChannel.snippetsGet, () => snippets.state.get());
      ipcMain.handle(MainInvokeChannel.clipboardRingGet, () => clipboardRing.ring.get());
      ipcMain.on(MainSendChannel.clipboardWrite, (_event, text: unknown) => {
        if (typeof text === 'string' && text.length <= MAX_CLIP_BYTES)
          void clipboardRing.copy(text);
      });
      ipcMain.on(MainSendChannel.snippetsOpenFile, () => {
        // Tests must not launch the user's editor.
        if (!options.e2e) void shell.openPath(source.path);
      });
      await source.ensureExists().catch((error: unknown) => {
        console.error('[main] cannot create snippets file', error);
      });
      await snippets.start();
      snippets.state.subscribe(() => {
        broadcast(RendererChannel.snippetsChanged, () => snippets.state.get());
      });
      await clipboardRing.start();
      clipboardRing.ring.subscribe(() => {
        broadcast(RendererChannel.clipboardRingChanged, () => clipboardRing.ring.get());
      });
    },
    dispose() {
      snippets.dispose();
      clipboardRing.dispose();
    },
  };
}
