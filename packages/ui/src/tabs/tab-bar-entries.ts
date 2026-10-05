import type { Tab, TabGroup, Workspace } from '@glaceon/domain';

export type TabBarEntry =
  | { readonly kind: 'group'; readonly group: TabGroup; readonly count: number }
  | {
      readonly kind: 'tab';
      readonly tab: Tab;
      /** 1-based position, matching ⌘1 … ⌘9. */
      readonly position: number;
      readonly group: TabGroup | undefined;
    };

/**
 * What the tab bar shows, left to right: a label before each group's tabs, and the tabs
 * themselves. Tabs of a collapsed group are hidden, except the active one.
 */
export function tabBarEntries(workspace: Workspace): TabBarEntry[] {
  const groups = new Map(workspace.groups.map((group) => [group.id, group]));
  const entries: TabBarEntry[] = [];
  let previous: TabGroup | undefined;
  workspace.tabs.forEach((tab, index) => {
    const group = tab.group === undefined ? undefined : groups.get(tab.group);
    if (group !== undefined && group !== previous) {
      const count = workspace.tabs.filter((t) => t.group === group.id).length;
      entries.push({ kind: 'group', group, count });
    }
    previous = group;
    if (group?.collapsed === true && tab.id !== workspace.activeTab) return;
    entries.push({ kind: 'tab', tab, position: index + 1, group });
  });
  return entries;
}
