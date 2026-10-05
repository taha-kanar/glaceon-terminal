import { asTabId, CommandIds as C } from '@glaceon/domain';
import type {
  Command,
  CommandContribution,
  CommandInvocation,
  DynamicCommandProvider,
} from '../command/command';
import type { ReadableStore } from '../store/store';
import type { WindowSummary } from './tab-transfer-port';
import type { TabTransferService } from './tab-transfer-service';

/** Moving the active tab to a new window or to one of the other windows. */
export class TransferCommands implements CommandContribution, DynamicCommandProvider {
  readonly #transfers: TabTransferService;
  readonly #windows: ReadableStore<readonly WindowSummary[]>;

  constructor(transfers: TabTransferService, windows: ReadableStore<readonly WindowSummary[]>) {
    this.#transfers = transfers;
    this.#windows = windows;
  }

  commands(): readonly Command[] {
    const transfers = this.#transfers;
    return [
      {
        id: C.tabMoveToNewWindow,
        title: 'Move Tab to New Window',
        category: 'Tab',
        run: (args) =>
          transfers
            .moveTab(typeof args === 'string' ? asTabId(args) : undefined, { kind: 'newWindow' })
            .then(() => undefined),
      },
      {
        id: C.tabMoveToWindow,
        title: 'Move Tab to Window',
        category: 'Tab',
        hideInPalette: true,
        run: (args) =>
          typeof args === 'number'
            ? transfers.moveTab(undefined, { kind: 'window', windowId: args }).then(() => undefined)
            : undefined,
      },
    ];
  }

  invocations(): readonly CommandInvocation[] {
    return this.#windows
      .get()
      .filter((window) => !window.current)
      .map((window) => ({
        id: `move-to-window:${String(window.id)}`,
        title: `Move Tab to ${window.title}`,
        category: 'Tab',
        command: C.tabMoveToWindow,
        args: window.id,
      }));
  }
}
