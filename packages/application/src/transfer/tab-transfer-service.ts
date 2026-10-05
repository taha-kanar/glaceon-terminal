import {
  addTab,
  allPaneIds,
  asPaneId,
  asTabId,
  createTab,
  findTab,
  leafIds,
  renameLeaves,
  type PaneId,
  type TabId,
  type Workspace,
} from '@glaceon/domain';
import type { IdGenerator } from '../ports/id-generator';
import type { ObservableStore } from '../store/store';
import type { PaneTransfer, SessionManager } from '../terminal/session-manager';
import type { WorkspaceService } from '../workspace/workspace-service';
import type { TabPayload, TabTransferPort, TransferTarget } from './tab-transfer-port';

/** Serialized screens of the window's views (escape sequences that redraw them). */
export interface SnapshotSource {
  snapshot(pane: PaneId): string | undefined;
}

export interface TabTransferServiceDeps {
  readonly store: ObservableStore<Workspace>;
  readonly workspace: Pick<WorkspaceService, 'forgetTab'>;
  readonly sessions: Pick<SessionManager, 'detach' | 'reattach' | 'expect'>;
  readonly views: SnapshotSource;
  readonly port: TabTransferPort;
  readonly ids: IdGenerator;
  readonly notify: (message: string) => void;
}

/**
 * Moves tabs between windows without restarting their shells: the shells are detached in
 * the pty host, the tab travels with screen snapshots, and the target attaches them. If the
 * target does not confirm, the shells are attached back here.
 */
export class TabTransferService {
  readonly #deps: TabTransferServiceDeps;
  readonly #moving = new Set<TabId>();

  constructor(deps: TabTransferServiceDeps) {
    this.#deps = deps;
  }

  async moveTab(tabId: TabId | undefined, target: TransferTarget): Promise<boolean> {
    const { store, sessions, views, port } = this.#deps;
    const tab = findTab(store.get(), tabId ?? store.get().activeTab);
    if (tab === undefined || this.#moving.has(tab.id)) return false;
    this.#moving.add(tab.id);
    try {
      const panes: { pane: PaneId; transfer?: PaneTransfer }[] = [];
      for (const pane of leafIds(tab.root)) {
        const detached = await sessions.detach(pane);
        const snapshot = views.snapshot(pane);
        panes.push(
          detached === undefined
            ? { pane }
            : { pane, transfer: snapshot === undefined ? detached : { ...detached, snapshot } },
        );
      }
      const payload: TabPayload = {
        ...(tab.title === undefined ? {} : { title: tab.title }),
        ...(tab.color === undefined ? {} : { color: tab.color }),
        locked: tab.locked,
        root: tab.root,
        activePane: tab.activePane,
        zoomed: tab.zoomed,
        panes,
      };
      const delivered = await port.send(payload, target).catch(() => false);
      if (delivered) {
        this.#deps.workspace.forgetTab(tab.id);
        return true;
      }
      await this.#rollBack(panes);
      return false;
    } finally {
      this.#moving.delete(tab.id);
    }
  }

  /** Opens a tab that arrived from another window. Resolves true once every shell is attached. */
  async importTab(payload: TabPayload): Promise<boolean> {
    const { store, sessions, ids } = this.#deps;
    const taken = new Set(allPaneIds(store.get()));
    const renamed = new Map<PaneId, PaneId>();
    for (const { pane } of payload.panes) {
      renamed.set(pane, taken.has(pane) ? asPaneId(ids.next()) : pane);
    }
    const rename = (pane: PaneId): PaneId => renamed.get(pane) ?? pane;
    const adopted = payload.panes.flatMap(({ pane, transfer }) =>
      transfer === undefined ? [] : [sessions.expect(rename(pane), transfer)],
    );
    const root = renameLeaves(payload.root, rename);
    const base = createTab(asTabId(ids.next()), rename(payload.activePane));
    store.update((workspace) =>
      addTab(
        workspace,
        {
          ...base,
          root,
          zoomed: payload.zoomed,
          title: payload.title,
          color: payload.color,
          locked: payload.locked,
        },
        workspace.activeTab,
      ),
    );
    const results = await Promise.all(adopted);
    return results.every(Boolean);
  }

  async #rollBack(panes: readonly { pane: PaneId; transfer?: PaneTransfer }[]): Promise<void> {
    const results = await Promise.all(
      panes.map(({ pane, transfer }) =>
        transfer === undefined
          ? Promise.resolve(true)
          : this.#deps.sessions.reattach(pane, transfer),
      ),
    );
    this.#deps.notify(
      results.every(Boolean)
        ? 'The tab could not be moved; it stays in this window.'
        : 'The tab could not be moved, and some of its shells were lost.',
    );
  }
}
