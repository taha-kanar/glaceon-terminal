export interface FlowWatermarks {
  /** Pause the pty once this many sent bytes are not yet rendered. */
  readonly high: number;
  /** Resume once the backlog falls below this. */
  readonly low: number;
}

export const DEFAULT_WATERMARKS: FlowWatermarks = { high: 100_000, low: 5_000 };

export interface FlowTarget {
  pause(): void;
  resume(): void;
}

/**
 * Back-pressure for one session: output is paused while the renderer lags behind, so a
 * `cat` of a huge file cannot flood the renderer and keystrokes such as ⌃C stay responsive.
 */
export class FlowController {
  readonly #target: FlowTarget;
  readonly #watermarks: FlowWatermarks;
  #unacknowledged = 0;
  #paused = false;

  constructor(target: FlowTarget, watermarks: FlowWatermarks = DEFAULT_WATERMARKS) {
    this.#target = target;
    this.#watermarks = watermarks;
  }

  get paused(): boolean {
    return this.#paused;
  }

  get backlog(): number {
    return this.#unacknowledged;
  }

  sent(bytes: number): void {
    this.#unacknowledged += bytes;
    if (!this.#paused && this.#unacknowledged > this.#watermarks.high) {
      this.#paused = true;
      this.#target.pause();
    }
  }

  /** Forgets the backlog, e.g. when a session moves to a client that never saw it. */
  reset(): void {
    this.#unacknowledged = 0;
    if (this.#paused) {
      this.#paused = false;
      this.#target.resume();
    }
  }

  acknowledged(bytes: number): void {
    this.#unacknowledged = Math.max(0, this.#unacknowledged - bytes);
    if (this.#paused && this.#unacknowledged < this.#watermarks.low) {
      this.#paused = false;
      this.#target.resume();
    }
  }
}
