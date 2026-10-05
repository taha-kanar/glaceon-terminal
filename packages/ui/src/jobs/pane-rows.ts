import type { SessionInfoMap } from '@glaceon/application';
import { leafIds, type PaneId, type Workspace } from '@glaceon/domain';
import { tabTitle } from '../tabs/tab-title';

export interface PaneRow {
  readonly pane: PaneId;
  /** e.g. "2 · api server" or "2 · zsh (pane 2)". */
  readonly label: string;
  readonly active: boolean;
}

/** Every pane of the window in tab order, labelled for the job views. */
export function paneRows(workspace: Workspace, sessions: SessionInfoMap): PaneRow[] {
  return workspace.tabs.flatMap((tab, index) => {
    const panes = leafIds(tab.root);
    const title = tab.title ?? tabTitle(tab, sessions);
    return panes.map((pane, paneIndex) => ({
      pane,
      label:
        panes.length === 1
          ? `${String(index + 1)} · ${title}`
          : `${String(index + 1)} · ${title} (pane ${String(paneIndex + 1)})`,
      active: tab.id === workspace.activeTab && pane === tab.activePane,
    }));
  });
}
