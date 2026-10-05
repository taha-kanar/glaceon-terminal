import type { RenameTarget } from '@glaceon/application';
import type { DropZone, PaneId, TabColor, TabGroupId, TabId } from '@glaceon/domain';

/** Tab metadata, groups and pane drag-and-drop intents. */
export interface ArrangeActions {
  readonly beginRename: (target: RenameTarget) => void;
  readonly commitRename: (name: string) => void;
  readonly cancelRename: () => void;
  readonly setColor: (tab: TabId, color: TabColor | undefined) => void;
  readonly togglePin: (tab: TabId) => void;
  readonly toggleLock: (tab: TabId) => void;
  readonly moveTab: (tab: TabId, toIndex: number) => void;
  readonly newGroup: (tab: TabId) => void;
  readonly setGroup: (tab: TabId, group: TabGroupId | undefined) => void;
  readonly toggleGroupCollapsed: (group: TabGroupId) => void;
  readonly setGroupColor: (group: TabGroupId, color: TabColor) => void;
  readonly ungroup: (group: TabGroupId) => void;
  readonly movePane: (source: PaneId, target: PaneId, zone: DropZone) => void;
}
