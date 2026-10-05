import { cycle } from '../shared/cycle';
import type { PaneId, TabId } from '../shared/ids';
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

export interface Tab {
  readonly id: TabId;
  readonly root: PaneNode;
  readonly activePane: PaneId;
  /** When true the active pane fills the whole tab. */
  readonly zoomed: boolean;
}

/** The tabs of one window. Invariant: `activeTab` names an existing tab whenever there is one. */
export interface Workspace {
  readonly tabs: readonly Tab[];
  readonly activeTab: TabId | undefined;
}

export const EMPTY_WORKSPACE: Workspace = { tabs: [], activeTab: undefined };

export function createTab(id: TabId, pane: PaneId): Tab {
  return { id, root: paneLeaf(pane), activePane: pane, zoomed: false };
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

/** Inserts a tab right after `after` (or at the end) and activates it. */
export function addTab(workspace: Workspace, tab: Tab, after?: TabId): Workspace {
  const index = after === undefined ? -1 : workspace.tabs.findIndex((t) => t.id === after);
  const tabs = [...workspace.tabs];
  tabs.splice(index < 0 ? tabs.length : index + 1, 0, tab);
  return { tabs, activeTab: tab.id };
}

/** Removes a tab. When it was active, its right neighbour (or else its left one) becomes active. */
export function closeTab(workspace: Workspace, id: TabId): Workspace {
  const index = workspace.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return workspace;
  const tabs = workspace.tabs.filter((tab) => tab.id !== id);
  if (workspace.activeTab !== id) return { ...workspace, tabs };
  const next = tabs[Math.min(index, tabs.length - 1)];
  return { tabs, activeTab: next?.id };
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

export function moveTab(workspace: Workspace, id: TabId, toIndex: number): Workspace {
  const tab = findTab(workspace, id);
  if (tab === undefined) return workspace;
  const tabs = workspace.tabs.filter((t) => t.id !== id);
  tabs.splice(Math.max(0, Math.min(tabs.length, toIndex)), 0, tab);
  return { ...workspace, tabs };
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
