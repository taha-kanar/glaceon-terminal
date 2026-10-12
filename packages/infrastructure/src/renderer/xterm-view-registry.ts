import type { SearchablePane, SearchTargets, TerminalViewRegistry } from '@glaceon/application';
import { Emitter, type Disposable, type PaneId, type TerminalLink } from '@glaceon/domain';
import { AtlasRecycler } from './atlas-recycler';
import { XtermTerminalView, type XtermViewOptions } from './xterm-terminal-view';
import type { WebglBudget } from './xterm-webgl';

export interface PaneLinkActivation {
  readonly pane: PaneId;
  readonly link: TerminalLink;
  readonly event: MouseEvent;
}

export interface PaneFocusChange {
  readonly pane: PaneId;
  readonly focused: boolean;
}

export interface PaneSelection {
  readonly pane: PaneId;
  readonly text: string;
}

/**
 * WebGL contexts a window may hold. Chromium allows 16 and silently drops the oldest beyond
 * that (leaving a blank pane for seconds); staying below keeps every pane drawn.
 */
export const WEBGL_CONTEXT_BUDGET = 12;

/**
 * Atlas texture bytes, every WebGL context's copy counted, past which the renderers are
 * rebuilt to drop the atlas. The GPU process grew about 3.3 times this much in a truecolor
 * soak; text in the 16 ANSI colors needs a few MB per context.
 */
export const ATLAS_RECYCLE_BYTES = 128 * 1024 * 1024;
const ATLAS_RECYCLE_INTERVAL_MS = 60_000;
/** Released atlas pages watched for leaks (the newest). */
const RELEASED_PAGES_WATCHED = 256;

interface Entry {
  readonly view: XtermTerminalView;
  readonly focus: Disposable;
  readonly selection: Disposable;
}

/**
 * Owns the xterm instances of a window. Views live outside React: a slot element only borrows
 * the view's host element while mounted, so re-renders and layout changes never recreate a
 * terminal or lose its scrollback.
 */
export class XtermViewRegistry implements TerminalViewRegistry, SearchTargets {
  readonly #document: Document;
  readonly #entries = new Map<PaneId, Entry>();
  readonly #hidden = new Set<PaneId>();
  readonly #focusChanged = new Emitter<PaneFocusChange>();
  readonly #linkActivated = new Emitter<PaneLinkActivation>();
  readonly #selected = new Emitter<PaneSelection>();
  #options: XtermViewOptions;
  readonly #budget: number;
  #contexts = 0;
  #contextLosses = 0;
  #atlasSwaps = 0;
  #atlasRecycles = 0;
  #released: WeakRef<HTMLCanvasElement>[] = [];
  readonly #recycler = new AtlasRecycler({
    bytes: () => this.#atlasTextureBytes(),
    recycle: () => {
      this.#atlasRecycles++;
      // Once no renderer holds the atlas it is freed; `release` re-attaches the visible views.
      for (const { view } of this.#entries.values()) view.releaseWebgl();
    },
    limit: ATLAS_RECYCLE_BYTES,
    minIntervalMs: ATLAS_RECYCLE_INTERVAL_MS,
    now: () => performance.now(),
    schedule: (callback, delayMs) => {
      setTimeout(() => requestIdleCallback(callback, { timeout: 2000 }), delayMs);
    },
  });
  readonly #webgl: WebglBudget = {
    acquire: (): boolean => {
      if (this.#contexts >= this.#budget) return false;
      this.#contexts++;
      return true;
    },
    release: (atlasPages): void => {
      this.#contexts--;
      this.#watchReleased(atlasPages);
      // Hand the freed context to a visible pane that had to fall back to the DOM renderer.
      queueMicrotask(() => {
        for (const pane of this.#entries.keys()) {
          if (this.#contexts >= this.#budget) return;
          if (!this.#hidden.has(pane)) this.#entries.get(pane)?.view.upgradeRenderer();
        }
      });
    },
    atlasChanged: (change) => {
      if (change === 'swap') this.#atlasSwaps++;
      this.#recycler.check();
    },
    contextLost: () => {
      this.#contextLosses++;
    },
  };

  constructor(document: Document, options: XtermViewOptions, budget = WEBGL_CONTEXT_BUDGET) {
    this.#document = document;
    this.#options = options;
    this.#budget = budget;
  }

  get size(): number {
    return this.#entries.size;
  }

  /** Bytes of the distinct glyph atlas pages the window's WebGL views draw with. */
  get atlasBytes(): number {
    const pages = new Set<HTMLCanvasElement>();
    for (const { view } of this.#entries.values()) {
      for (const page of view.atlasPages()) pages.add(page);
    }
    let bytes = 0;
    for (const page of pages) bytes += page.width * page.height * 4;
    return bytes;
  }

  /** Times a view's glyph atlas was swapped for another (each one redraws every glyph). */
  get atlasSwaps(): number {
    return this.#atlasSwaps;
  }

  /** Times the renderers were rebuilt to free an oversized atlas. */
  get atlasRecycles(): number {
    return this.#atlasRecycles;
  }

  /** Every WebGL context uploads each page of its atlas as a texture of its own. */
  #atlasTextureBytes(): number {
    let bytes = 0;
    for (const { view } of this.#entries.values()) {
      for (const page of view.atlasPages()) bytes += page.width * page.height * 4;
    }
    return bytes;
  }

  /** WebGL contexts the browser took away unasked. */
  get contextLosses(): number {
    return this.#contextLosses;
  }

  /**
   * Bytes of atlas pages that released renderers drew with, no view draws with now, and are
   * still alive: a leak once garbage has been collected (leak tests read it after a GC).
   */
  get leakedAtlasBytes(): number {
    const live = new Set<HTMLCanvasElement>();
    for (const { view } of this.#entries.values()) {
      for (const page of view.atlasPages()) live.add(page);
    }
    let bytes = 0;
    for (const reference of this.#released) {
      const page = reference.deref();
      if (page !== undefined && !live.has(page)) bytes += page.width * page.height * 4;
    }
    return bytes;
  }

  #watchReleased(pages: readonly HTMLCanvasElement[]): void {
    const known = new Set(this.#released.map((reference) => reference.deref()));
    for (const page of pages) {
      if (!known.has(page)) this.#released.push(new WeakRef(page));
    }
    if (this.#released.length > RELEASED_PAGES_WATCHED) {
      this.#released = this.#released
        .filter((reference) => reference.deref() !== undefined)
        .slice(-RELEASED_PAGES_WATCHED);
    }
  }

  snapshot(pane: PaneId): string | undefined {
    return this.#entries.get(pane)?.view.serialize();
  }

  get(pane: PaneId): XtermTerminalView | undefined {
    return this.#entries.get(pane)?.view;
  }

  panes(): PaneId[] {
    return [...this.#entries.keys()];
  }

  /** Puts the pane's view into `slot`, creating the view on first use. */
  attach(pane: PaneId, slot: HTMLElement): { view: XtermTerminalView; created: boolean } {
    const existing = this.#entries.get(pane);
    if (existing !== undefined) {
      if (existing.view.element.parentElement !== slot) slot.append(existing.view.element);
      return { view: existing.view, created: false };
    }
    const host = this.#document.createElement('div');
    host.className = 'terminal-host';
    slot.append(host);
    const view = new XtermTerminalView(host, {
      ...this.#options,
      webgl: this.#webgl,
      onLink: (link, event) => {
        this.#linkActivated.emit({ pane, link, event });
      },
    });
    const focus = view.onFocusChange((focused) => this.#focusChanged.emit({ pane, focused }));
    const selection = view.onSelection((text) => this.#selected.emit({ pane, text }));
    this.#entries.set(pane, { view, focus, selection });
    if (this.#hidden.has(pane)) view.setVisible(false);
    return { view, created: true };
  }

  /** Takes the view out of `slot` (if it is still there) without destroying it. */
  detach(pane: PaneId, slot: HTMLElement): void {
    const element = this.#entries.get(pane)?.view.element;
    if (element?.parentElement === slot) element.remove();
  }

  setVisible(pane: PaneId, visible: boolean): void {
    if (visible) this.#hidden.delete(pane);
    else this.#hidden.add(pane);
    this.#entries.get(pane)?.view.setVisible(visible);
  }

  release(pane: PaneId): void {
    const entry = this.#entries.get(pane);
    this.#hidden.delete(pane);
    if (entry === undefined) return;
    this.#entries.delete(pane);
    entry.focus.dispose();
    entry.selection.dispose();
    entry.view.dispose();
    entry.view.element.remove();
  }

  setOptions(options: XtermViewOptions): void {
    this.#options = options;
    for (const { view } of this.#entries.values()) view.setOptions(options);
  }

  searchable(pane: PaneId): SearchablePane | undefined {
    return this.get(pane);
  }

  onLinkActivated(listener: (activation: PaneLinkActivation) => void): Disposable {
    return this.#linkActivated.on(listener);
  }

  onSelection(listener: (selection: PaneSelection) => void): Disposable {
    return this.#selected.on(listener);
  }

  onFocusChange(listener: (change: PaneFocusChange) => void): Disposable {
    return this.#focusChanged.on(listener);
  }
}
