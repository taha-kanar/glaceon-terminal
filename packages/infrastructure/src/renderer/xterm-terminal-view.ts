import '@xterm/xterm/css/xterm.css';
import type { TerminalView } from '@glaceon/application';
import {
  Emitter,
  toDisposable,
  type CursorStyle,
  type Disposable,
  type TerminalSize,
} from '@glaceon/domain';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal, type ITheme } from '@xterm/xterm';

export interface XtermViewOptions {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly theme: ITheme;
  readonly cursorStyle: CursorStyle;
  readonly cursorBlink: boolean;
  readonly scrollback: number;
  readonly macOptionIsMeta: boolean;
}

/** TerminalView backed by xterm.js with the WebGL renderer (DOM renderer as fallback). */
export class XtermTerminalView implements TerminalView {
  readonly element: HTMLElement;
  readonly #terminal: Terminal;
  readonly #fitAddon = new FitAddon();
  readonly #resizeObserver: ResizeObserver;
  readonly #focus = new Emitter<boolean>();
  readonly #cleanup: (() => void)[] = [];
  #webgl: WebglAddon | undefined;
  #visible = true;
  #pendingFit = 0;

  /** `host` must already be in the document so the renderer can measure the font. */
  constructor(host: HTMLElement, options: XtermViewOptions) {
    this.element = host;
    this.#terminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      drawBoldTextInBrightColors: false,
      ...options,
    });
    this.#terminal.loadAddon(this.#fitAddon);
    this.#terminal.loadAddon(new Unicode11Addon());
    this.#terminal.unicode.activeVersion = '11';
    this.#terminal.open(host);
    this.#attachWebgl();
    this.#trackFocus();

    this.#resizeObserver = new ResizeObserver(() => {
      this.#scheduleFit();
    });
    this.#resizeObserver.observe(host);
  }

  write(chunk: Uint8Array, written?: () => void): void {
    this.#terminal.write(chunk, written);
  }

  fit(): TerminalSize {
    this.#fitAddon.fit();
    return { cols: this.#terminal.cols, rows: this.#terminal.rows };
  }

  focus(): void {
    this.#terminal.focus();
  }

  clear(): void {
    this.#terminal.clear();
  }

  onInput(listener: (data: string) => void): Disposable {
    const subscription = this.#terminal.onData(listener);
    return toDisposable(() => subscription.dispose());
  }

  onResize(listener: (size: TerminalSize) => void): Disposable {
    const subscription = this.#terminal.onResize(({ cols, rows }) => listener({ cols, rows }));
    return toDisposable(() => subscription.dispose());
  }

  onFocusChange(listener: (focused: boolean) => void): Disposable {
    return this.#focus.on(listener);
  }

  setOptions(options: XtermViewOptions): void {
    Object.assign(this.#terminal.options, options);
    this.#scheduleFit();
  }

  /** Hidden views give up their WebGL context; browsers allow only ~16 at a time. */
  setVisible(visible: boolean): void {
    if (visible === this.#visible) return;
    this.#visible = visible;
    if (visible) {
      this.#attachWebgl();
      this.#scheduleFit();
    } else {
      this.#webgl?.dispose();
      this.#webgl = undefined;
    }
  }

  get rendererKind(): 'webgl' | 'dom' {
    return this.#webgl === undefined ? 'dom' : 'webgl';
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

  get size(): TerminalSize {
    return { cols: this.#terminal.cols, rows: this.#terminal.rows };
  }

  dispose(): void {
    cancelAnimationFrame(this.#pendingFit);
    this.#resizeObserver.disconnect();
    for (const cleanup of this.#cleanup) cleanup();
    this.#focus.clear();
    this.#webgl?.dispose();
    this.#terminal.dispose();
  }

  #scheduleFit(): void {
    cancelAnimationFrame(this.#pendingFit);
    this.#pendingFit = requestAnimationFrame(() => {
      if (this.element.isConnected) this.#fitAddon.fit();
    });
  }

  #trackFocus(): void {
    const textarea = this.#terminal.textarea;
    if (textarea === undefined) return;
    const onFocus = (): void => this.#focus.emit(true);
    const onBlur = (): void => this.#focus.emit(false);
    textarea.addEventListener('focus', onFocus);
    textarea.addEventListener('blur', onBlur);
    this.#cleanup.push(() => {
      textarea.removeEventListener('focus', onFocus);
      textarea.removeEventListener('blur', onBlur);
    });
  }

  #attachWebgl(): void {
    if (this.#webgl !== undefined) return;
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        if (this.#webgl === webgl) this.#webgl = undefined;
      });
      this.#terminal.loadAddon(webgl);
      this.#webgl = webgl;
    } catch {
      // No WebGL2 available: xterm keeps using its DOM renderer.
      this.#webgl = undefined;
    }
  }
}
