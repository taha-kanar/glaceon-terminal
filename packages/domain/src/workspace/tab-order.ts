import type { TabGroupId } from '../shared/ids';
import type { Tab, Workspace } from './workspace';

/**
 * Restores the workspace invariants after an edit: pinned tabs first, pinned tabs ungrouped,
 * each group's tabs adjacent (where its first tab is), no empty groups. Returns the same
 * object when nothing had to change.
 */
export function normalizeTabs(workspace: Workspace): Workspace {
  const groups = new Set(workspace.groups.map((group) => group.id));
  const cleaned = workspace.tabs.map((tab) =>
    tab.group !== undefined && (tab.pinned || !groups.has(tab.group))
      ? { ...tab, group: undefined }
      : tab,
  );
  const ordered: Tab[] = cleaned.filter((tab) => tab.pinned);
  const emitted = new Set<TabGroupId>();
  for (const tab of cleaned) {
    if (tab.pinned) continue;
    if (tab.group === undefined) ordered.push(tab);
    else if (!emitted.has(tab.group)) {
      emitted.add(tab.group);
      ordered.push(...cleaned.filter((t) => !t.pinned && t.group === tab.group));
    }
  }
  const liveGroups = workspace.groups.filter((group) => emitted.has(group.id));
  const unchanged =
    ordered.every((tab, i) => tab === workspace.tabs[i]) &&
    liveGroups.length === workspace.groups.length;
  return unchanged ? workspace : { ...workspace, tabs: ordered, groups: liveGroups };
}
