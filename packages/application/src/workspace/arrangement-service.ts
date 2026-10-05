import {
  activeTab,
  applyLayout,
  asPaneId,
  asTabGroupId,
  asTabId,
  findLayout,
  findTab,
  groupTabs,
  layoutSlots,
  leafIds,
  movePane,
  moveTab,
  paneToNewTab,
  patchGroup,
  patchTab,
  setTabGroup,
  TAB_COLORS,
  ungroup,
  type DropZone,
  type PaneId,
  type TabColor,
  type TabGroupId,
  type TabId,
  type Workspace,
} from '@glaceon/domain';
import type { IdGenerator } from '../ports/id-generator';
import { ObservableStore, type ReadableStore } from '../store/store';
import type { SessionManager } from '../terminal/session-manager';

export type RenameTarget =
  | { readonly kind: 'tab'; readonly id: TabId }
  | { readonly kind: 'group'; readonly id: TabGroupId };

export interface ArrangementServiceDeps {
  readonly store: ObservableStore<Workspace>;
  readonly ids: IdGenerator;
  readonly sessions: Pick<SessionManager, 'prepare' | 'cwdOf'>;
  readonly notify: (message: string) => void;
}

/** Tab metadata, tab groups, pane drag-and-drop and layouts. */
export class ArrangementService {
  readonly #deps: ArrangementServiceDeps;
  readonly #renaming = new ObservableStore<RenameTarget | undefined>(undefined);

  constructor(deps: ArrangementServiceDeps) {
    this.#deps = deps;
  }

  get #workspace(): Workspace {
    return this.#deps.store.get();
  }

  #update(change: (workspace: Workspace) => Workspace): void {
    this.#deps.store.update(change);
  }

  #tab(id: TabId | undefined): TabId | undefined {
    return findTab(this.#workspace, id ?? this.#workspace.activeTab)?.id;
  }

  /** What is being renamed inline in the tab bar, if anything. */
  get renaming(): ReadableStore<RenameTarget | undefined> {
    return this.#renaming;
  }

  beginRename(target?: RenameTarget): void {
    const tab = this.#tab(undefined);
    const next = target ?? (tab === undefined ? undefined : { kind: 'tab', id: tab });
    if (next !== undefined) this.#renaming.set(next);
  }

  /** An empty name gives a tab its automatic title back; groups keep their old name. */
  commitRename(name: string): void {
    const target = this.#renaming.get();
    this.#renaming.set(undefined);
    if (target?.kind === 'tab') this.#update((ws) => patchTab(ws, target.id, { title: name }));
    if (target?.kind === 'group') this.#update((ws) => patchGroup(ws, target.id, { name }));
  }

  cancelRename(): void {
    this.#renaming.set(undefined);
  }

  setColor(color: TabColor | undefined, tab?: TabId): void {
    const id = this.#tab(tab);
    if (id !== undefined) this.#update((ws) => patchTab(ws, id, { color }));
  }

  togglePin(tab?: TabId): void {
    const current = findTab(this.#workspace, this.#tab(tab));
    if (current !== undefined)
      this.#update((ws) => patchTab(ws, current.id, { pinned: !current.pinned }));
  }

  toggleLock(tab?: TabId): void {
    const current = findTab(this.#workspace, this.#tab(tab));
    if (current !== undefined)
      this.#update((ws) => patchTab(ws, current.id, { locked: !current.locked }));
  }

  moveTab(tab: TabId, toIndex: number): void {
    this.#update((ws) => moveTab(ws, tab, toIndex));
  }

  /** Puts the tab in a new group and starts renaming the group. */
  newGroup(tab?: TabId): void {
    const id = this.#tab(tab);
    if (id === undefined) return;
    const group = asTabGroupId(this.#deps.ids.next());
    const used = new Set(this.#workspace.groups.map((g) => g.color));
    const color = TAB_COLORS.find((c) => !used.has(c)) ?? 'blue';
    const name = `Group ${String(this.#workspace.groups.length + 1)}`;
    this.#update((ws) => groupTabs(ws, [id], { id: group, name, color }));
    this.#renaming.set({ kind: 'group', id: group });
  }

  setGroup(group: TabGroupId | undefined, tab?: TabId): void {
    const id = this.#tab(tab);
    if (id !== undefined) this.#update((ws) => setTabGroup(ws, id, group));
  }

  toggleGroupCollapsed(group: TabGroupId): void {
    const current = this.#workspace.groups.find((g) => g.id === group);
    if (current !== undefined) {
      this.#update((ws) => patchGroup(ws, group, { collapsed: !current.collapsed }));
    }
  }

  setGroupColor(group: TabGroupId, color: TabColor): void {
    this.#update((ws) => patchGroup(ws, group, { color }));
  }

  ungroup(group: TabGroupId): void {
    this.#update((ws) => ungroup(ws, group));
  }

  movePane(source: PaneId, drop: { readonly target: PaneId; readonly zone: DropZone }): void {
    this.#update((ws) => movePane(ws, source, drop));
  }

  paneToNewTab(pane: PaneId | undefined = activeTab(this.#workspace)?.activePane): void {
    if (pane === undefined) return;
    const tab = asTabId(this.#deps.ids.next());
    this.#update((ws) => paneToNewTab(ws, pane, tab));
  }

  /** Applies a layout to the active tab, opening new panes (in the active pane's cwd) as needed. */
  async applyLayout(layoutId: string): Promise<void> {
    const template = findLayout(layoutId);
    const tab = activeTab(this.#workspace);
    if (template === undefined || tab === undefined) return;
    const panes = leafIds(tab.root).length;
    const slots = layoutSlots(template, panes);
    if (slots === undefined) {
      this.#deps.notify(
        `${template.name} has room for ${String(template.slots)} panes; this tab has ${String(panes)}.`,
      );
      return;
    }
    const newPanes = Array.from({ length: slots - panes }, () => asPaneId(this.#deps.ids.next()));
    if (newPanes.length > 0) {
      const cwd = await this.#deps.sessions.cwdOf(tab.activePane);
      if (cwd !== undefined)
        for (const pane of newPanes) this.#deps.sessions.prepare(pane, { cwd });
    }
    this.#update((ws) => applyLayout(ws, tab.id, { template, newPanes }));
  }
}
