import type { PaneId, TabId } from '../shared/ids';
import { layoutSlots, type LayoutTemplate } from '../pane/layout-templates';
import { insertBeside, moveLeaf, type DropZone } from '../pane/pane-moves';
import { leafIds, removeLeaf } from '../pane/pane-tree';
import { normalizeTabs } from './tab-order';
import {
  activateTab,
  addTab,
  closeTab,
  createTab,
  findTab,
  focusPane,
  tabOfPane,
  updateTab,
  type Workspace,
} from './workspace';

/** Takes a pane out of its tab without closing its shell; a tab left empty goes away. */
function detachPane(workspace: Workspace, pane: PaneId): Workspace {
  const tab = tabOfPane(workspace, pane);
  if (tab === undefined) return workspace;
  const root = removeLeaf(tab.root, pane);
  if (root === undefined) return closeTab(workspace, tab.id);
  const activePane = tab.activePane === pane ? (leafIds(root)[0] ?? pane) : tab.activePane;
  return updateTab(workspace, tab.id, (t) => ({ ...t, root, activePane, zoomed: false }));
}

/**
 * Drops `source` on `target` (possibly in another tab): an edge zone splits the target, the
 * center swaps the two panes. The moved pane becomes the active one.
 */
export function movePane(
  workspace: Workspace,
  source: PaneId,
  drop: { readonly target: PaneId; readonly zone: DropZone },
): Workspace {
  const from = tabOfPane(workspace, source);
  const to = tabOfPane(workspace, drop.target);
  if (from === undefined || to === undefined || source === drop.target) return workspace;
  if (from.id === to.id) {
    const moved = updateTab(workspace, to.id, (tab) => ({
      ...tab,
      root: moveLeaf(tab.root, source, drop),
      zoomed: false,
    }));
    return focusPane(moved, source);
  }
  if (drop.zone === 'center') return workspace;
  const detached = detachPane(workspace, source);
  const inserted = updateTab(detached, to.id, (tab) => ({
    ...tab,
    root: insertBeside(tab.root, source, drop),
    zoomed: false,
  }));
  return focusPane(inserted, source);
}

/** Moves a pane into a new tab of its own, opened right after its current tab. */
export function paneToNewTab(workspace: Workspace, pane: PaneId, newTab: TabId): Workspace {
  const from = tabOfPane(workspace, pane);
  if (from === undefined || leafIds(from.root).length < 2) return workspace;
  const detached = detachPane(workspace, pane);
  return addTab(detached, { ...createTab(newTab, pane), group: from.group }, from.id);
}

/** Moves a pane to the end of another tab. */
export function paneToTab(workspace: Workspace, pane: PaneId, tab: TabId): Workspace {
  const target = findTab(workspace, tab);
  const from = tabOfPane(workspace, pane);
  if (target === undefined || from === undefined || from.id === tab) return workspace;
  const last = leafIds(target.root).at(-1);
  if (last === undefined) return workspace;
  return normalizeTabs(
    activateTab(movePane(workspace, pane, { target: last, zone: 'right' }), tab),
  );
}

/**
 * Rearranges a tab's panes with a layout template. Existing panes keep their place in reading
 * order (and their shells); `newPanes` fill any extra slots. Returns the workspace unchanged
 * when the layout has fewer slots than the tab has panes.
 */
export function applyLayout(
  workspace: Workspace,
  tabId: TabId,
  layout: { readonly template: LayoutTemplate; readonly newPanes: readonly PaneId[] },
): Workspace {
  const tab = findTab(workspace, tabId);
  if (tab === undefined) return workspace;
  const current = leafIds(tab.root);
  const slots = layoutSlots(layout.template, current.length);
  if (slots === undefined) return workspace;
  const extra = layout.newPanes.slice(0, slots - current.length);
  if (current.length + extra.length < slots) return workspace;
  const root = layout.template.build([...current, ...extra]);
  return updateTab(workspace, tabId, (t) => ({ ...t, root, zoomed: false }));
}
