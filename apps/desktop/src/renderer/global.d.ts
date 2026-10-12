import type { GlaceonBridge } from '@glaceon/contracts';

declare global {
  interface Window {
    readonly glaceon: GlaceonBridge;
    __glaceonE2E?: E2EProbe;
  }
}

export interface ProbeTab {
  readonly id: string;
  readonly active: boolean;
  readonly panes: readonly string[];
  readonly activePane: string;
  readonly zoomed: boolean;
  readonly title?: string;
  readonly color?: string;
  readonly pinned: boolean;
  readonly locked: boolean;
  /** Name of the tab's group. */
  readonly group?: string;
  /** Pane rectangles in unit coordinates, reading order. */
  readonly rects: readonly { pane: string; x: number; y: number; width: number; height: number }[];
}

export interface ProbeSessionInfo {
  readonly pid?: number;
  readonly shell?: string;
  readonly process?: string;
  readonly exit?: { readonly exitCode: number; readonly signal?: number };
  readonly error?: string;
}

/** Read-only hooks for Playwright; only installed when running under e2e. */
export interface E2EProbe {
  /** Text of a pane's terminal (the active pane when omitted). */
  terminalText(pane?: string): string;
  sessionPid(pane?: string): number | undefined;
  activePane(): string | undefined;
  workspace(): ProbeTab[];
  sessionInfo(pane: string): ProbeSessionInfo | undefined;
  problems(): string[];
  fontSize(): number;
  rendererKind(pane: string): 'webgl' | 'dom' | undefined;
  locateText(text: string): { x: number; y: number } | undefined;
  /** Frames a pane's terminal has drawn so far. */
  renders(pane: string): number;
  /** Counts of live objects, for leak tests. */
  resources(): ProbeResources;
}

export interface ProbeResources {
  readonly views: number;
  readonly sessions: number;
  readonly domNodes: number;
  readonly webglViews: number;
  /** Used JS heap after a forced GC (needs `--js-flags=--expose-gc`), in bytes. */
  readonly heap?: number;
  /** Bytes of the glyph atlas pages the WebGL views draw with (each context uploads them). */
  readonly atlasBytes: number;
  /** Times a view's glyph atlas was swapped for another. */
  readonly atlasSwaps: number;
  /** Times the renderers were rebuilt to free an oversized atlas. */
  readonly atlasRecycles: number;
  /** Atlas pages of released renderers still alive after the GC: a leak. */
  readonly leakedAtlasBytes: number;
  /** WebGL contexts the browser took away unasked. */
  readonly contextLosses: number;
  /** The GPU's largest texture side, which bounds an atlas page. */
  readonly maxTextureSize: number;
}
