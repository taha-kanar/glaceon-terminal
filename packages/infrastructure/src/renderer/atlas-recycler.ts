export interface AtlasRecyclerDeps {
  /** Bytes the glyph atlases currently take on the GPU. */
  readonly bytes: () => number;
  /** Rebuilds the WebGL renderers, which drops their atlases. */
  readonly recycle: () => void;
  readonly limit: number;
  /** Rebuilds are at least this far apart. */
  readonly minIntervalMs: number;
  readonly now: () => number;
  /** Runs `callback` once `delayMs` has passed and the page is idle. */
  readonly schedule: (callback: () => void, delayMs: number) => void;
}

/**
 * Keeps xterm's WebGL glyph atlas in bounds. The atlas only grows: every glyph in every new
 * color adds to it, its pages merge into larger ones up to the GPU's largest texture
 * (16384² = 1 GiB on Apple GPUs), and every WebGL context holds its own copy. Clearing it
 * keeps the pages' size, so past the limit the renderers are rebuilt, which drops it.
 */
export class AtlasRecycler {
  readonly #deps: AtlasRecyclerDeps;
  #last = Number.NEGATIVE_INFINITY;
  #scheduled = false;

  constructor(deps: AtlasRecyclerDeps) {
    this.#deps = deps;
  }

  /** Call whenever an atlas may have grown. */
  check(): void {
    if (this.#scheduled || this.#deps.bytes() < this.#deps.limit) return;
    this.#scheduled = true;
    const wait = Math.max(0, this.#last + this.#deps.minIntervalMs - this.#deps.now());
    this.#deps.schedule(() => {
      this.#scheduled = false;
      // Closing panes may have freed enough in the meantime.
      if (this.#deps.bytes() < this.#deps.limit) return;
      this.#last = this.#deps.now();
      this.#deps.recycle();
    }, wait);
  }
}
