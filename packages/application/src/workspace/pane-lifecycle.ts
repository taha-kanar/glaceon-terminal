import {
  activeTab,
  allPaneIds,
  leafIds,
  type Disposable,
  type PaneId,
  type Settings,
  type Workspace,
} from '@glaceon/domain';
import type { TerminalViewRegistry } from '../ports/terminal-view-registry';
import type { ReadableStore } from '../store/store';
import type { SessionManager } from '../terminal/session-manager';
import type { WorkspaceService } from './workspace-service';

export interface PaneLifecycleDeps {
  readonly workspace: ReadableStore<Workspace>;
  readonly service: WorkspaceService;
  readonly sessions: SessionManager;
  readonly views: TerminalViewRegistry;
  readonly settings: ReadableStore<Settings>;
}

function visiblePanes(workspace: Workspace): Set<PaneId> {
  const tab = activeTab(workspace);
  if (tab === undefined) return new Set();
  return new Set(tab.zoomed ? [tab.activePane] : leafIds(tab.root));
}

/**
 * Keeps sessions and views in step with the workspace: closed panes lose their shell and view,
 * hidden panes release GPU resources, the active pane gets keyboard focus, and exited shells
 * are closed according to `closeOnExit`.
 */
export function bindPaneLifecycle(deps: PaneLifecycleDeps): Disposable {
  const { workspace, sessions, views } = deps;
  let known = new Set<PaneId>();
  let visible = new Set<PaneId>();
  let focused: PaneId | undefined;

  const sync = (): void => {
    const current = workspace.get();
    const panes = new Set(allPaneIds(current));
    for (const pane of known) {
      if (!panes.has(pane)) {
        sessions.release(pane);
        views.release(pane);
      }
    }
    known = panes;

    const nowVisible = visiblePanes(current);
    for (const pane of panes) {
      if (nowVisible.has(pane) !== visible.has(pane)) views.setVisible(pane, nowVisible.has(pane));
    }
    visible = nowVisible;

    const active = activeTab(current)?.activePane;
    if (active !== focused) {
      focused = active;
      if (active !== undefined) sessions.focus(active);
    }
  };

  const subscription = workspace.subscribe(sync);
  const exits = sessions.onDidExit(({ pane, exit }) => {
    const policy = deps.settings.get().closeOnExit;
    const clean = exit.exitCode === 0 && exit.signal === undefined;
    if (policy === 'always' || (policy === 'clean' && clean)) deps.service.dismissPane(pane);
  });
  sync();
  return {
    dispose() {
      subscription.dispose();
      exits.dispose();
    },
  };
}
