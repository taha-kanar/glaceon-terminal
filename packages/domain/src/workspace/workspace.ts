import { cycle } from '../shared/cycle';
import type { PaneId, TabGroupId, TabId } from '../shared/ids';
import {
  containsLeaf,
  equalize,
  leafIds,
  paneLeaf,
  removeLeaf,
  resizeLeaf,
  setRatioAt,
  splitLeaf,
  type Direction,
  type PaneNode,
  type SplitAxis,
  type SplitPath,
} from '../pane/pane-tree';
import { normalizeTabs } from './tab-order';

export interface Tab {
  readonly id: TabId;
  readonly root: PaneNode;
  readonly activePane: PaneId;
  /** When true the active pane fills the whole tab. */
  readonly zoomed: boolean;
  /** A name the user gave the tab; otherwise it is named after its process. */
  readonly title: string | undefined;
  readonly color: TabColor | undefined;
  /** Locked tabs and their panes cannot be closed. */
  readonly locked: boolean;
  /** Pinned tabs sit first, show only their index and cannot be closed. */
  readonly pinned: boolean;
  readonly group: TabGroupId | undefined;
}

export const TAB_COLORS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'] as const;
export type TabColor = (typeof TAB_COLORS)[number];

export interface TabGroup {
  readonly id: TabGroupId;
  readonly name: string;
  readonly color: TabColor;
  /** Collapsed groups show only their label (and the active tab, when it is in the group). */
  readonly collapsed: boolean;
}

/**
 * The tabs of one window. Invariants: `activeTab` names an existing tab whenever there is one;
 * pinned tabs come first; the tabs of a group are adjacent; every group has at least one tab.
 */
export interface Workspace {
  readonly tabs: readonly Tab[];
  readonly activeTab: TabId | undefined;
  readonly groups: readonly TabGroup[];
}

export const EMPTY_WORKSPACE: Workspace = { tabs: [], activeTab: undefined, groups: [] };

export function createTab(id: TabId, pane: PaneId): Tab {
  return {
    id,
    root: paneLeaf(pane),
    activePane: pane,
    zoomed: false,
    title: undefined,
    color: undefined,
    locked: false,
    pinned: false,
    group: undefined,
  };
}

export function findTab(workspace: Workspace, id: TabId | undefined): Tab | undefined {
  return workspace.tabs.find((tab) => tab.id === id);
}

export function activeTab(workspace: Workspace): Tab | undefined {
  return findTab(workspace, workspace.activeTab);
}

export function tabOfPane(workspace: Workspace, pane: PaneId): Tab | undefined {
  return workspace.tabs.find((tab) => containsLeaf(tab.root, pane));
}

export function allPaneIds(workspace: Workspace): PaneId[] {
  return workspace.tabs.flatMap((tab) => leafIds(tab.root));
}

/**
 * Inserts a tab right after `after` (or at the end) and activates it. A tab opened next to a
 * grouped tab joins that group; one opened next to a pinned tab goes after the pinned ones.
 */
export function addTab(workspace: Workspace, tab: Tab, after?: TabId): Workspace {
  const index = after === undefined ? -1 : workspace.tabs.findIndex((t) => t.id === after);
  const neighbour = workspace.tabs[index];
  const placed: Tab =
    neighbour?.group !== undefined && tab.group === undefined
      ? { ...tab, group: neighbour.group }
      : tab;
  const tabs = [...workspace.tabs];
  tabs.splice(index < 0 ? tabs.length : index + 1, 0, placed);
  return normalizeTabs({ ...workspace, tabs, activeTab: tab.id });
}

/** Removes a tab. When it was active, its right neighbour (or else its left one) becomes active. */
export function closeTab(workspace: Workspace, id: TabId): Workspace {
  const index = workspace.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return workspace;
  const tabs = workspace.tabs.filter((tab) => tab.id !== id);
  if (workspace.activeTab !== id) return normalizeTabs({ ...workspace, tabs });
  const next = tabs[Math.min(index, tabs.length - 1)];
  return normalizeTabs({ ...workspace, tabs, activeTab: next?.id });
}

export function activateTab(workspace: Workspace, id: TabId): Workspace {
  return findTab(workspace, id) === undefined || workspace.activeTab === id
    ? workspace
    : { ...workspace, activeTab: id };
}

export function cycleTab(workspace: Workspace, offset: number): Workspace {
  const ids = workspace.tabs.map((tab) => tab.id);
  const target =
    workspace.activeTab === undefined ? undefined : cycle(ids, workspace.activeTab, offset);
  return target === undefined ? workspace : activateTab(workspace, target);
}

export function updateTab(workspace: Workspace, id: TabId, update: (tab: Tab) => Tab): Workspace {
  const index = workspace.tabs.findIndex((tab) => tab.id === id);
  const tab = workspace.tabs[index];
  if (tab === undefined) return workspace;
  const next = update(tab);
  if (next === tab) return workspace;
  const tabs = [...workspace.tabs];
  tabs[index] = next;
  return { ...workspace, tabs };
}

/** Makes `pane` the active pane and its tab the active tab. */
export function focusPane(workspace: Workspace, pane: PaneId): Workspace {
  const tab = tabOfPane(workspace, pane);
  if (tab === undefined) return workspace;
  const focused = updateTab(workspace, tab.id, (t) =>
    t.activePane === pane ? t : { ...t, activePane: pane, zoomed: false },
  );
  return activateTab(focused, tab.id);
}

export function splitPane(
  workspace: Workspace,
  target: PaneId,
  split: { readonly newPane: PaneId; readonly axis: SplitAxis },
): Workspace {
  const tab = tabOfPane(workspace, target);
  if (tab === undefined) return workspace;
  return updateTab(workspace, tab.id, (t) => ({
    ...t,
    root: splitLeaf(t.root, target, { newId: split.newPane, axis: split.axis }),
    activePane: split.newPane,
    zoomed: false,
  }));
}

/**
 * Removes a pane. The pane before it in reading order (or the new first pane) becomes active;
 * a tab whose last pane goes away is closed.
 */
export function closePane(workspace: Workspace, pane: PaneId): Workspace {
  const tab = tabOfPane(workspace, pane);
  if (tab === undefined) return workspace;
  const root = removeLeaf(tab.root, pane);
  if (root === undefined) return closeTab(workspace, tab.id);
  const order = leafIds(tab.root);
  const remaining = leafIds(root);
  const fallback = order[order.indexOf(pane) - 1] ?? remaining[0] ?? pane;
  const activePane = tab.activePane === pane ? fallback : tab.activePane;
  return updateTab(workspace, tab.id, (t) => ({
    ...t,
    root,
    activePane,
    zoomed: t.zoomed && t.activePane !== pane,
  }));
}

export function toggleZoom(workspace: Workspace, id: TabId): Workspace {
  return updateTab(workspace, id, (tab) =>
    tab.root.kind === 'leaf' && !tab.zoomed ? tab : { ...tab, zoomed: !tab.zoomed },
  );
}

export function setSplitRatio(
  workspace: Workspace,
  id: TabId,
  change: { readonly path: SplitPath; readonly ratio: number },
): Workspace {
  return updateTab(workspace, id, (tab) => ({
    ...tab,
    root: setRatioAt(tab.root, change.path, change.ratio),
  }));
}

export function equalizePanes(workspace: Workspace, id: TabId): Workspace {
  return updateTab(workspace, id, (tab) => ({ ...tab, root: equalize(tab.root) }));
}

export function resizePane(
  workspace: Workspace,
  pane: PaneId,
  move: { readonly direction: Direction; readonly delta: number },
): Workspace {
  const tab = tabOfPane(workspace, pane);
  if (tab === undefined) return workspace;
  return updateTab(workspace, tab.id, (t) => ({ ...t, root: resizeLeaf(t.root, pane, move) }));
}
