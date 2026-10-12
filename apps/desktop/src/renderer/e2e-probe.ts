import type { ReadableStore, SessionManager } from '@glaceon/application';
import {
  activeTab,
  asPaneId,
  computeLayout,
  findGroup,
  leafIds,
  type PaneId,
  type Workspace,
} from '@glaceon/domain';
import type { XtermViewRegistry } from '@glaceon/infrastructure/renderer';
import type { E2EProbe, ProbeResources } from './global';

export interface ProbeSources {
  readonly workspace: ReadableStore<Workspace>;
  readonly sessions: SessionManager;
  readonly views: XtermViewRegistry;
  readonly problems: ReadableStore<readonly string[]>;
  readonly fontSize: () => number;
}

interface GcPerformance {
  readonly memory?: { readonly usedJSHeapSize: number };
}

let maxTextureSize: number | undefined;

/** Asked once, of a throwaway context that is freed right away. */
function readMaxTextureSize(): number {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (gl === null) return 0;
  const size = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return size;
}

function resources(views: XtermViewRegistry, sessions: SessionManager): ProbeResources {
  const gc = (globalThis as { gc?: () => void }).gc;
  gc?.();
  const heap = (performance as GcPerformance).memory?.usedJSHeapSize;
  const panes = views.panes();
  maxTextureSize ??= readMaxTextureSize();
  return {
    views: views.size,
    sessions: sessions.info.get().size,
    domNodes: document.getElementsByTagName('*').length,
    webglViews: panes.filter((pane) => views.get(pane)?.rendererKind === 'webgl').length,
    ...(gc === undefined || heap === undefined ? {} : { heap }),
    atlasBytes: views.atlasBytes,
    atlasSwaps: views.atlasSwaps,
    atlasRecycles: views.atlasRecycles,
    leakedAtlasBytes: views.leakedAtlasBytes,
    contextLosses: views.contextLosses,
    maxTextureSize,
  };
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
        pinned: tab.pinned,
        locked: tab.locked,
        ...(tab.title === undefined ? {} : { title: tab.title }),
        ...(tab.color === undefined ? {} : { color: tab.color }),
        ...(tab.group === undefined ? {} : { group: findGroup(current, tab.group)?.name ?? '' }),
        rects: computeLayout(tab.root).panes.map(({ id, rect }) => ({ pane: id, ...rect })),
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
    renders: (pane) => views.get(asPaneId(pane))?.renderCount ?? 0,
    resources: () => resources(views, sessions),
  };
}
