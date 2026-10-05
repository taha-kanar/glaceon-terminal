import '@xterm/xterm/css/xterm.css';
import type { TerminalView } from '@glaceon/application';
import { toDisposable, type Disposable, type TerminalSize } from '@glaceon/domain';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal, type ITheme } from '@xterm/xterm';

export interface XtermViewOptions {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly theme: ITheme;
}

/** TerminalView backed by xterm.js with the WebGL renderer (DOM renderer as fallback). */
export class XtermTerminalView implements TerminalView {
  readonly #terminal: Terminal;
  readonly #fitAddon = new FitAddon();
  readonly #resizeObserver: ResizeObserver;
  #webgl: WebglAddon | undefined;
  #pendingFit = 0;

  constructor(container: HTMLElement, options: XtermViewOptions) {
    this.#terminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      cursorBlink: true,
      fontFamily: options.fontFamily,
      fontSize: options.fontSize,
      macOptionIsMeta: false,
      scrollback: 10_000,
      theme: options.theme,
    });
    this.#terminal.loadAddon(this.#fitAddon);
    this.#terminal.loadAddon(new Unicode11Addon());
    this.#terminal.unicode.activeVersion = '11';
    this.#terminal.open(container);
    this.#attachWebgl();

    this.#resizeObserver = new ResizeObserver(() => {
      this.#scheduleFit();
    });
    this.#resizeObserver.observe(container);
  }

  write(chunk: Uint8Array): void {
    this.#terminal.write(chunk);
  }

  fit(): TerminalSize {
    this.#fitAddon.fit();
    return { cols: this.#terminal.cols, rows: this.#terminal.rows };
  }

  focus(): void {
    this.#terminal.focus();
  }

  onInput(listener: (data: string) => void): Disposable {
    const subscription = this.#terminal.onData(listener);
    return toDisposable(() => subscription.dispose());
  }

  onResize(listener: (size: TerminalSize) => void): Disposable {
    const subscription = this.#terminal.onResize(({ cols, rows }) => listener({ cols, rows }));
    return toDisposable(() => subscription.dispose());
  }

  /**
   * Plain text of the active buffer with soft-wrapped rows joined back into logical lines.
   * Used by e2e tests (the WebGL canvas has no DOM text).
   */
  readText(): string {
    const buffer = this.#terminal.buffer.active;
    const lines: string[] = [];
    let current = '';
    for (let row = 0; row < buffer.length; row++) {
      const continues = buffer.getLine(row + 1)?.isWrapped ?? false;
      current += buffer.getLine(row)?.translateToString(!continues) ?? '';
      if (!continues) {
        lines.push(current);
        current = '';
      }
    }
    return lines.join('\n').trimEnd();
  }

  dispose(): void {
    cancelAnimationFrame(this.#pendingFit);
    this.#resizeObserver.disconnect();
    this.#webgl?.dispose();
    this.#terminal.dispose();
  }

  #scheduleFit(): void {
    cancelAnimationFrame(this.#pendingFit);
    this.#pendingFit = requestAnimationFrame(() => {
      this.#fitAddon.fit();
    });
  }

  #attachWebgl(): void {
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        this.#webgl = undefined;
      });
      this.#terminal.loadAddon(webgl);
      this.#webgl = webgl;
    } catch {
      // No WebGL2 available: xterm keeps using its DOM renderer.
      this.#webgl = undefined;
    }
  }
}
