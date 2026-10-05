import {
  activeTab,
  addTab,
  allPaneIds,
  asPaneId,
  asTabId,
  closePane,
  closeTab,
  computeLayout,
  createTab,
  cycle,
  cycleTab,
  equalizePanes,
  findTab,
  focusPane,
  leafIds,
  tabOfPane,
  navigate,
  resizePane,
  setSplitRatio,
  splitPane,
  toggleZoom,
  type Direction,
  type PaneId,
  type Settings,
  type SplitAxis,
  type SplitPath,
  type TabId,
  type Workspace,
} from '@glaceon/domain';
import type { ConfirmationService } from '../confirmation/confirmation-service';
import type { IdGenerator } from '../ports/id-generator';
import type { WindowPort } from '../ports/window-port';
import type { ObservableStore, ReadableStore } from '../store/store';
import type { SessionManager } from '../terminal/session-manager';

export interface WorkspaceServiceDeps {
  readonly store: ObservableStore<Workspace>;
  readonly ids: IdGenerator;
  readonly sessions: SessionManager;
  readonly confirmation: ConfirmationService;
  readonly settings: ReadableStore<Settings>;
  readonly window: WindowPort;
  /** Tells the user why something did not happen (e.g. the tab is locked). */
  readonly notify?: (message: string) => void;
}

const RESIZE_STEP = 0.05;

/** Tab and pane operations of one window. */
export class WorkspaceService {
  readonly #deps: WorkspaceServiceDeps;

  constructor(deps: WorkspaceServiceDeps) {
    this.#deps = deps;
  }

  get #workspace(): Workspace {
    return this.#deps.store.get();
  }

  get activePane(): PaneId | undefined {
    return activeTab(this.#workspace)?.activePane;
  }

  #update(change: (workspace: Workspace) => Workspace): void {
    this.#deps.store.update(change);
    if (this.#workspace.tabs.length === 0) this.#deps.window.close();
  }

  newTab(options: { readonly cwd?: string } = {}): PaneId {
    const pane = asPaneId(this.#deps.ids.next());
    if (options.cwd !== undefined) this.#deps.sessions.prepare(pane, { cwd: options.cwd });
    const tab = createTab(asTabId(this.#deps.ids.next()), pane);
    this.#update((ws) => addTab(ws, tab, ws.activeTab));
    return pane;
  }

  /** Opens a first tab when the window has none. */
  ensureTab(): void {
    if (this.#workspace.tabs.length === 0) this.newTab();
  }

  async split(axis: SplitAxis): Promise<PaneId | undefined> {
    const target = this.activePane;
    if (target === undefined) return undefined;
    const cwd = await this.#deps.sessions.cwdOf(target);
    const pane = asPaneId(this.#deps.ids.next());
    if (cwd !== undefined) this.#deps.sessions.prepare(pane, { cwd });
    this.#update((ws) => splitPane(ws, target, { newPane: pane, axis }));
    return pane;
  }

  async closePane(pane: PaneId | undefined = this.activePane): Promise<void> {
    if (pane === undefined) return;
    const tab = tabOfPane(this.#workspace, pane);
    if (tab === undefined) return;
    if (tab.locked || (tab.pinned && leafIds(tab.root).length === 1)) {
      this.#refuse(tab.locked ? 'This tab is locked.' : 'Pinned tabs cannot be closed.');
      return;
    }
    if (!(await this.#confirmClose([pane], 'Close pane?'))) return;
    this.#update((ws) => closePane(ws, pane));
  }

  /** Closes a pane without asking (its shell already exited). */
  dismissPane(pane: PaneId): void {
    this.#update((ws) => closePane(ws, pane));
  }

  async closeTab(id: TabId | undefined = this.#workspace.activeTab): Promise<void> {
    const tab = findTab(this.#workspace, id);
    if (tab === undefined) return;
    if (tab.locked || tab.pinned) {
      this.#refuse(tab.locked ? 'This tab is locked.' : 'Pinned tabs cannot be closed.');
      return;
    }
    if (!(await this.#confirmClose(leafIds(tab.root), 'Close tab?'))) return;
    this.#update((ws) => closeTab(ws, tab.id));
  }

  /** Asks before closing the window when any shell in it is running something. */
  async confirmWindowClose(): Promise<boolean> {
    return this.#confirmClose(allPaneIds(this.#workspace), 'Close window?');
  }

  selectTab(id: TabId): void {
    this.#update((ws) => (ws.activeTab === id ? ws : { ...ws, activeTab: id }));
  }

  /** 1-based; 9 always selects the last tab, as in browsers. */
  selectTabAt(position: number): void {
    const { tabs } = this.#workspace;
    const tab = position >= 9 ? tabs.at(-1) : tabs[position - 1];
    if (tab !== undefined) this.selectTab(tab.id);
  }

  cycleTab(offset: number): void {
    this.#update((ws) => cycleTab(ws, offset));
  }

  focusPane(pane: PaneId): void {
    this.#update((ws) => focusPane(ws, pane));
  }

  focusDirection(direction: Direction): void {
    const tab = activeTab(this.#workspace);
    if (tab === undefined || tab.zoomed) return;
    const target = navigate(computeLayout(tab.root), tab.activePane, direction);
    if (target !== undefined) this.focusPane(target);
  }

  focusOffset(offset: number): void {
    const tab = activeTab(this.#workspace);
    if (tab === undefined) return;
    const target = cycle(leafIds(tab.root), tab.activePane, offset);
    if (target !== undefined) this.focusPane(target);
  }

  toggleZoom(): void {
    const id = this.#workspace.activeTab;
    if (id !== undefined) this.#update((ws) => toggleZoom(ws, id));
  }

  equalize(): void {
    const id = this.#workspace.activeTab;
    if (id !== undefined) this.#update((ws) => equalizePanes(ws, id));
  }

  resize(direction: Direction): void {
    const pane = this.activePane;
    if (pane !== undefined)
      this.#update((ws) => resizePane(ws, pane, { direction, delta: RESIZE_STEP }));
  }

  setRatio(tab: TabId, change: { readonly path: SplitPath; readonly ratio: number }): void {
    this.#update((ws) => setSplitRatio(ws, tab, change));
  }

  #refuse(message: string): void {
    this.#deps.notify?.(message);
  }

  async #confirmClose(panes: readonly PaneId[], title: string): Promise<boolean> {
    const { sessions, settings, confirmation } = this.#deps;
    if (!settings.get().confirmCloseRunningProcess) return true;
    const busy = panes.filter((pane) => sessions.isBusy(pane));
    if (busy.length === 0) return true;
    const names = busy.map((pane) => sessions.info.get().get(pane)?.process ?? 'a process');
    return confirmation.confirm({
      title,
      message: `${[...new Set(names)].join(', ')} ${busy.length === 1 ? 'is' : 'are'} still running.`,
      confirmLabel: 'Close',
    });
  }
}
