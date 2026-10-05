import type { ReadableStore, SessionManager } from '@glaceon/application';
import { activeTab, asPaneId, leafIds, type PaneId, type Workspace } from '@glaceon/domain';
import type { XtermViewRegistry } from '@glaceon/infrastructure/renderer';
import type { E2EProbe } from './global';

export interface ProbeSources {
  readonly workspace: ReadableStore<Workspace>;
  readonly sessions: SessionManager;
  readonly views: XtermViewRegistry;
  readonly problems: ReadableStore<readonly string[]>;
  readonly fontSize: () => number;
}

/** Read-only view of the window state for Playwright. */
export function createE2EProbe(sources: ProbeSources): E2EProbe {
  const { workspace, sessions, views } = sources;
  const resolve = (pane: string | undefined): PaneId | undefined => {
    if (pane !== undefined) return asPaneId(pane);
    return activeTab(workspace.get())?.activePane;
  };
  return {
    terminalText: (pane) => {
      const id = resolve(pane);
      return id === undefined ? '' : (views.get(id)?.readText() ?? '');
    },
    sessionPid: (pane) => {
      const id = resolve(pane);
      return id === undefined ? undefined : sessions.info.get().get(id)?.pid;
    },
    activePane: () => resolve(undefined),
    workspace: () => {
      const current = workspace.get();
      return current.tabs.map((tab) => ({
        id: tab.id,
        active: tab.id === current.activeTab,
        panes: leafIds(tab.root),
        activePane: tab.activePane,
        zoomed: tab.zoomed,
      }));
    },
    sessionInfo: (pane) => {
      const info = sessions.info.get().get(asPaneId(pane));
      return info === undefined ? undefined : { ...info };
    },
    problems: () => [...sources.problems.get()],
    fontSize: sources.fontSize,
    rendererKind: (pane) => views.get(asPaneId(pane))?.rendererKind,
    locateText: (text) => {
      const id = resolve(undefined);
      return id === undefined ? undefined : views.get(id)?.locateText(text);
    },
  };
}
