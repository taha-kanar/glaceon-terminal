import type { Tab, TabGroup, Workspace } from '@glaceon/domain';
import type { MenuEntry } from '../menu/ContextMenu';
import type { ArrangeActions } from './arrange-actions';

export function tabMenu(
  tab: Tab,
  context: {
    readonly workspace: Workspace;
    readonly arrange: ArrangeActions;
    readonly closeTab: () => void;
  },
): MenuEntry[] {
  const { workspace, arrange } = context;
  const otherGroups = workspace.groups.filter((group) => group.id !== tab.group);
  return [
    {
      kind: 'item',
      label: 'Rename…',
      onSelect: () => arrange.beginRename({ kind: 'tab', id: tab.id }),
    },
    {
      kind: 'colors',
      value: tab.color,
      allowNone: true,
      onSelect: (color) => arrange.setColor(tab.id, color),
    },
    { kind: 'separator' },
    {
      kind: 'item',
      label: tab.pinned ? 'Unpin Tab' : 'Pin Tab',
      onSelect: () => arrange.togglePin(tab.id),
    },
    {
      kind: 'item',
      label: tab.locked ? 'Unlock Tab' : 'Lock Tab',
      onSelect: () => arrange.toggleLock(tab.id),
    },
    { kind: 'separator' },
    { kind: 'item', label: 'Add to New Group', onSelect: () => arrange.newGroup(tab.id) },
    ...otherGroups.map((group): MenuEntry => ({
      kind: 'item',
      label: `Move to “${group.name}”`,
      onSelect: () => arrange.setGroup(tab.id, group.id),
    })),
    ...(tab.group === undefined
      ? []
      : [
          {
            kind: 'item',
            label: 'Remove from Group',
            onSelect: () => arrange.setGroup(tab.id, undefined),
          } satisfies MenuEntry,
        ]),
    { kind: 'separator' },
    {
      kind: 'item',
      label: 'Close Tab',
      disabled: tab.pinned || tab.locked,
      onSelect: context.closeTab,
    },
  ];
}

export function groupMenu(group: TabGroup, arrange: ArrangeActions): MenuEntry[] {
  return [
    {
      kind: 'item',
      label: 'Rename Group…',
      onSelect: () => arrange.beginRename({ kind: 'group', id: group.id }),
    },
    {
      kind: 'colors',
      value: group.color,
      allowNone: false,
      onSelect: (color) => {
        if (color !== undefined) arrange.setGroupColor(group.id, color);
      },
    },
    { kind: 'separator' },
    {
      kind: 'item',
      label: group.collapsed ? 'Expand Group' : 'Collapse Group',
      onSelect: () => arrange.toggleGroupCollapsed(group.id),
    },
    { kind: 'item', label: 'Ungroup', onSelect: () => arrange.ungroup(group.id) },
  ];
}
