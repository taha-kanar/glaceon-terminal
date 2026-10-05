import type { TabGroupId, TabId } from '../shared/ids';
import { normalizeTabs } from './tab-order';
import {
  findTab,
  updateTab,
  type Tab,
  type TabColor,
  type TabGroup,
  type Workspace,
} from './workspace';

export type TabPatch = Partial<Pick<Tab, 'title' | 'color' | 'locked' | 'pinned'>>;

/** Changes a tab's name, color, lock or pin and keeps pinned tabs in front. */
export function patchTab(workspace: Workspace, id: TabId, patch: TabPatch): Workspace {
  const title = patch.title?.trim();
  const next = {
    ...patch,
    ...('title' in patch ? { title: title === '' ? undefined : title } : {}),
  };
  return normalizeTabs(updateTab(workspace, id, (tab) => ({ ...tab, ...next })));
}

/**
 * Moves a tab to `toIndex` (an index into the tab list without the moved tab). Dropped between
 * two tabs of a group it joins that group; dropped away from its group it leaves it.
 */
export function moveTab(workspace: Workspace, id: TabId, toIndex: number): Workspace {
  const tab = findTab(workspace, id);
  if (tab === undefined) return workspace;
  const tabs = workspace.tabs.filter((t) => t.id !== id);
  const index = Math.max(0, Math.min(tabs.length, toIndex));
  const before = tabs[index - 1];
  const after = tabs[index];
  let group = tab.group;
  if (before?.group !== undefined && before.group === after?.group) group = before.group;
  else if (group !== undefined && before?.group !== group && after?.group !== group) {
    group = undefined;
  }
  // Pinning follows the drop position, so tabs can be dragged in and out of the pinned area.
  const pinned = tab.pinned ? before?.pinned === true || index === 0 : after?.pinned === true;
  tabs.splice(
    index,
    0,
    group === tab.group && pinned === tab.pinned ? tab : { ...tab, group, pinned },
  );
  return normalizeTabs({ ...workspace, tabs });
}

/** Puts tabs into a new group (taking them out of pinned and other groups). */
export function groupTabs(
  workspace: Workspace,
  tabIds: readonly TabId[],
  group: { readonly id: TabGroupId; readonly name: string; readonly color: TabColor },
): Workspace {
  const members = new Set(tabIds);
  if (!workspace.tabs.some((tab) => members.has(tab.id))) return workspace;
  return normalizeTabs({
    ...workspace,
    groups: [...workspace.groups, { ...group, collapsed: false }],
    tabs: workspace.tabs.map((tab) =>
      members.has(tab.id) ? { ...tab, group: group.id, pinned: false } : tab,
    ),
  });
}

/** Moves a tab into an existing group, or out of any group with `undefined`. */
export function setTabGroup(
  workspace: Workspace,
  id: TabId,
  group: TabGroupId | undefined,
): Workspace {
  if (group !== undefined && !workspace.groups.some((g) => g.id === group)) return workspace;
  return normalizeTabs(
    updateTab(workspace, id, (tab) =>
      tab.group === group ? tab : { ...tab, group, pinned: group === undefined && tab.pinned },
    ),
  );
}

export function patchGroup(
  workspace: Workspace,
  id: TabGroupId,
  patch: Partial<Pick<TabGroup, 'name' | 'color' | 'collapsed'>>,
): Workspace {
  const name = patch.name?.trim();
  if (name === '') return workspace;
  return {
    ...workspace,
    groups: workspace.groups.map((group) =>
      group.id === id ? { ...group, ...patch, ...(name === undefined ? {} : { name }) } : group,
    ),
  };
}

/** Removes a group; its tabs stay open, ungrouped. */
export function ungroup(workspace: Workspace, id: TabGroupId): Workspace {
  return normalizeTabs({ ...workspace, groups: workspace.groups.filter((g) => g.id !== id) });
}

export function findGroup(workspace: Workspace, id: TabGroupId | undefined): TabGroup | undefined {
  return workspace.groups.find((group) => group.id === id);
}
