import { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';

/** Past this many lines a change of columns, which reflows every line, waits to settle. */
const REFLOW_DEBOUNCE_LINES = 200;
const REFLOW_DEBOUNCE_MS = 100;

/**
 * Keeps a terminal sized to its element. Fits run on the next frame and skip hidden terminals
 * (their pty keeps its size until shown). Rows follow at once, but on a long buffer new
 * columns wait until the size has settled, as in VS Code, so a divider drag or a window
 * resize reflows the scrollback and signals the shell once instead of every frame.
 */
export class XtermFit {
  readonly #terminal: Terminal;
  readonly #element: HTMLElement;
  readonly #addon = new FitAddon();
  readonly #observer: ResizeObserver;
  #frame = 0;
  #columns: ReturnType<typeof setTimeout> | undefined;
  /** False while the terminal is hidden. */
  active = true;

  constructor(terminal: Terminal, element: HTMLElement) {
    this.#terminal = terminal;
    this.#element = element;
    terminal.loadAddon(this.#addon);
    this.#observer = new ResizeObserver(() => {
      this.schedule();
    });
    this.#observer.observe(element);
  }

  schedule(): void {
    if (!this.active) return;
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => {
      if (this.#element.isConnected) this.fit(false);
    });
  }

  /** Fits now; with `settled` false a change of columns may wait (see above). */
  fit(settled: boolean): void {
    clearTimeout(this.#columns);
    this.#columns = undefined;
    const proposed = this.#addon.proposeDimensions();
    if (proposed === undefined || Number.isNaN(proposed.cols) || Number.isNaN(proposed.rows)) {
      return;
    }
    const terminal = this.#terminal;
    const { cols, rows } = proposed;
    if (cols === terminal.cols && rows === terminal.rows) return;
    if (
      settled ||
      cols === terminal.cols ||
      terminal.buffer.active.length <= REFLOW_DEBOUNCE_LINES
    ) {
      terminal.resize(cols, rows);
      return;
    }
    if (rows !== terminal.rows) terminal.resize(terminal.cols, rows);
    this.#columns = setTimeout(() => {
      if (this.#element.isConnected) this.fit(true);
    }, REFLOW_DEBOUNCE_MS);
  }

  dispose(): void {
    cancelAnimationFrame(this.#frame);
    clearTimeout(this.#columns);
    this.#observer.disconnect();
  }
}
