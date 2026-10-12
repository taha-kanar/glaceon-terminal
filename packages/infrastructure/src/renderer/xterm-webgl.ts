import { WebglAddon } from '@xterm/addon-webgl';
import type { Terminal } from '@xterm/xterm';

/** Hands out the window's limited WebGL contexts and watches what they hold. */
export interface WebglBudget {
  /** False when no context is left; the view then renders with the DOM renderer. */
  acquire(): boolean;
  /** Gives the context back; `atlasPages` are the pages the renderer drew with. */
  release(atlasPages: readonly HTMLCanvasElement[]): void;
  /**
   * The view's glyph atlas was swapped for another (new colors or font metrics) or may have
   * gained or lost pages.
   */
  atlasChanged(change: 'swap' | 'page'): void;
  /** The browser took a context away unasked (Chromium drops the oldest one past 16). */
  contextLost(): void;
}

/** What the addon keeps private but has to be reached (addon-webgl 0.19). */
interface WebglInternals {
  readonly _renderer?: {
    /** Its pages are what the GPU holds per context. */
    readonly _charAtlas?: { readonly pages?: readonly { readonly canvas: HTMLCanvasElement }[] };
    /** Not disposed with the renderer (see `detach`). */
    readonly _cursorBlinkStateManager?: { dispose(): void };
  };
}

/**
 * A terminal's WebGL renderer, attached while the budget grants it a context. Without it
 * xterm draws with its DOM renderer.
 */
export class XtermWebgl {
  readonly #terminal: Terminal;
  readonly #budget: WebglBudget;
  #addon: WebglAddon | undefined;
  /** Canvases the addon added to the screen. */
  #canvases: HTMLCanvasElement[] = [];

  constructor(terminal: Terminal, budget: WebglBudget) {
    this.#terminal = terminal;
    this.#budget = budget;
  }

  get attached(): boolean {
    return this.#addon !== undefined;
  }

  attach(): void {
    if (this.#addon !== undefined || !this.#budget.acquire()) return;
    const screen = this.#terminal.element?.querySelector('.xterm-screen');
    const existing = new Set(screen?.querySelectorAll('canvas'));
    try {
      const addon = new WebglAddon();
      addon.onContextLoss(() => {
        if (this.#addon === addon) this.detach();
      });
      addon.onChangeTextureAtlas(() => {
        this.#budget.atlasChanged('swap');
      });
      const pageChanged = (): void => {
        this.#budget.atlasChanged('page');
      };
      addon.onAddTextureAtlasCanvas(pageChanged);
      addon.onRemoveTextureAtlasCanvas(pageChanged);
      this.#terminal.loadAddon(addon);
      this.#addon = addon;
      this.#canvases = [...(screen?.querySelectorAll('canvas') ?? [])].filter(
        (canvas) => !existing.has(canvas),
      );
      for (const canvas of this.#canvases) {
        canvas.addEventListener('webglcontextlost', this.#contextLost);
      }
      // The renderer picked its atlas while loading, before these listeners were attached.
      this.#budget.atlasChanged('page');
    } catch {
      // No WebGL2 available: xterm keeps using its DOM renderer.
      this.#addon = undefined;
      this.#budget.release([]);
    }
  }

  detach(): void {
    if (this.#addon === undefined) return;
    const pages = this.atlasPages();
    const renderer = (this.#addon as unknown as WebglInternals)._renderer;
    this.#addon.dispose();
    this.#addon = undefined;
    // The renderer does not dispose its cursor blinker, whose timer keeps running once the
    // terminal had focus: it would hold the dead renderer, its glyph atlas and context forever.
    renderer?._cursorBlinkStateManager?.dispose();
    for (const canvas of this.#canvases) {
      canvas.removeEventListener('webglcontextlost', this.#contextLost);
      // The addon only deletes what it drew with: the context and its drawing buffers would
      // live until garbage collection, counting toward Chromium's limit of 16 meanwhile.
      // (A 2D canvas, such as the link layer, has no WebGL context to give.)
      canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.#canvases = [];
    this.#budget.release(pages);
  }

  /** Pages of the glyph atlas it draws with; terminals with the same font and colors share it. */
  atlasPages(): readonly HTMLCanvasElement[] {
    if (this.#addon === undefined) return [];
    const pages = (this.#addon as unknown as WebglInternals)._renderer?._charAtlas?.pages;
    if (pages !== undefined) return pages.map((page) => page.canvas);
    // A newer addon may move them: the first page is public.
    const first = this.#addon.textureAtlas;
    return first === undefined ? [] : [first];
  }

  readonly #contextLost = (): void => {
    this.#budget.contextLost();
  };
}
