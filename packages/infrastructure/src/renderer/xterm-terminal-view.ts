import '@xterm/xterm/css/xterm.css';
import type {
  SearchablePane,
  SearchOptions,
  SearchResults,
  TerminalView,
} from '@glaceon/application';
import {
  Emitter,
  toDisposable,
  type CursorStyle,
  type Disposable,
  type TerminalSize,
} from '@glaceon/domain';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { Terminal, type ITheme } from '@xterm/xterm';
import { readLogicalLine, TerminalLinkProvider, type LinkActivation } from './link-provider';
import { XtermFit } from './xterm-fit';
import { XtermWebgl, type WebglBudget } from './xterm-webgl';

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
  /** Search highlight colors (#rrggbb). */
  readonly searchColors: { readonly match: string; readonly active: string };
}

/** Options that change the cell size, after which the terminal is fitted again. */
const METRIC_OPTIONS: ReadonlySet<string> = new Set([
  'fontFamily',
  'fontSize',
  'lineHeight',
  'letterSpacing',
]);

/** Themes are rebuilt with every settings change; equal colors must not redraw every glyph. */
function sameTheme(current: ITheme | undefined, next: ITheme): boolean {
  if (current === next) return true;
  if (current === undefined) return false;
  const keys = Object.keys(next) as (keyof ITheme)[];
  return (
    keys.length === Object.keys(current).length && keys.every((key) => current[key] === next[key])
  );
}

/** xterm 6 keeps this private: its render service pauses while the screen is out of view. */
interface RenderServiceInternals {
  readonly _core?: {
    readonly _renderService?: {
      _handleIntersectionChange?(entry: Pick<IntersectionObserverEntry, 'isIntersecting'>): void;
    };
  };
}

export interface XtermViewHooks {
  readonly onLink: LinkActivation;
  readonly webgl: WebglBudget;
}

/** TerminalView backed by xterm.js with the WebGL renderer (DOM renderer as fallback). */
export class XtermTerminalView implements TerminalView, SearchablePane {
  readonly element: HTMLElement;
  readonly #terminal: Terminal;
  readonly #searchAddon = new SearchAddon();
  readonly #serializeAddon = new SerializeAddon();
  #searchColors: XtermViewOptions['searchColors'];
  #lastSearchKey = '';
  readonly #fit: XtermFit;
  readonly #focus = new Emitter<boolean>();
  readonly #cleanup: (() => void)[] = [];
  readonly #webgl: XtermWebgl;
  #visible = true;
  #renders = 0;

  /** `host` must already be in the document so the renderer can measure the font. */
  constructor(host: HTMLElement, options: XtermViewOptions & XtermViewHooks) {
    this.element = host;
    const { searchColors, onLink, webgl, ...terminalOptions } = options;
    this.#searchColors = searchColors;
    this.#terminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      drawBoldTextInBrightColors: false,
      ...terminalOptions,
    });
    this.#terminal.loadAddon(this.#searchAddon);
    this.#terminal.loadAddon(this.#serializeAddon);
    const links = this.#terminal.registerLinkProvider(
      new TerminalLinkProvider(this.#terminal, onLink),
    );
    this.#cleanup.push(() => {
      links.dispose();
    });
    this.#terminal.loadAddon(new Unicode11Addon());
    this.#terminal.unicode.activeVersion = '11';
    this.#terminal.onRender(() => {
      this.#renders++;
    });
    this.#terminal.open(host);
    this.#webgl = new XtermWebgl(this.#terminal, webgl);
    this.#webgl.attach();
    this.#trackFocus();
    this.#fit = new XtermFit(this.#terminal, host);
  }

  write(chunk: Uint8Array, written?: () => void): void {
    this.#terminal.write(chunk, written);
  }

  paste(text: string): void {
    this.#terminal.paste(text);
  }

  selectionText(): string {
    return this.#terminal.getSelection();
  }

  selectAll(): void {
    this.#terminal.selectAll();
  }

  /** Fires with the selected text whenever a selection is made (for copy-on-select). */
  onSelection(listener: (text: string) => void): Disposable {
    const subscription = this.#terminal.onSelectionChange(() => {
      const text = this.#terminal.getSelection();
      if (text !== '') listener(text);
    });
    return toDisposable(() => subscription.dispose());
  }

  restore(snapshot: string): void {
    this.#terminal.write(snapshot);
  }

  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.#terminal.write('', resolve);
    });
  }

  /** Screen and scrollback as escape sequences that redraw them in another terminal. */
  serialize(): string {
    return this.#serializeAddon.serialize();
  }

  fit(): TerminalSize {
    this.#fit.fit(true);
    return this.size;
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

  /** Applies only what changed: a new theme redraws every glyph, new metrics refit. */
  setOptions(options: XtermViewOptions): void {
    const { searchColors, ...terminalOptions } = options;
    this.#searchColors = searchColors;
    const current = this.#terminal.options;
    const changed: Record<string, unknown> = {};
    for (const key of Object.keys(terminalOptions) as (keyof typeof terminalOptions)[]) {
      const value = terminalOptions[key];
      const same =
        key === 'theme' ? sameTheme(current.theme, terminalOptions.theme) : current[key] === value;
      if (!same) changed[key] = value;
    }
    Object.assign(current, changed);
    if (Object.keys(changed).some((key) => METRIC_OPTIONS.has(key))) this.#fit.schedule();
  }

  find(query: string, options: SearchOptions & { readonly backwards: boolean }): void {
    const { match, active } = this.#searchColors;
    const searchOptions = {
      caseSensitive: options.caseSensitive,
      regex: options.regex,
      wholeWord: options.wholeWord,
      decorations: {
        matchBackground: match,
        matchOverviewRuler: match,
        activeMatchBackground: active,
        activeMatchColorOverviewRuler: active,
      },
    };
    // The addon keeps stale result counts when only the options change; start over instead.
    const key = `${String(options.caseSensitive)}${String(options.regex)}${String(options.wholeWord)}`;
    if (key !== this.#lastSearchKey) this.#searchAddon.clearDecorations();
    this.#lastSearchKey = key;
    try {
      if (options.backwards) this.#searchAddon.findPrevious(query, searchOptions);
      else this.#searchAddon.findNext(query, { ...searchOptions, incremental: true });
    } catch {
      // An incomplete regular expression while typing: no matches yet.
      this.#searchAddon.clearDecorations();
    }
  }

  clearSearch(): void {
    this.#searchAddon.clearDecorations();
    this.#terminal.clearSelection();
  }

  onSearchResults(listener: (results: SearchResults) => void): Disposable {
    const subscription = this.#searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
      listener({ index: resultIndex, count: resultCount });
    });
    return toDisposable(() => subscription.dispose());
  }

  /** Screen position of the last occurrence of `text` (e2e tests click on links with it). */
  locateText(text: string): { x: number; y: number } | undefined {
    const buffer = this.#terminal.buffer.active;
    // Bottom-up, so output wins over the command line that printed it.
    for (let row = buffer.length - 1; row >= 0; row--) {
      if (buffer.getLine(row)?.isWrapped === true) continue;
      const line = readLogicalLine(this.#terminal, row);
      const index = line?.text.lastIndexOf(text) ?? -1;
      const cell = index < 0 ? undefined : line?.cells[index + 1];
      if (cell !== undefined) return this.cellCenter(cell.row, cell.x);
    }
    return undefined;
  }

  /** Pixel position of the center of a cell in the viewport. */
  cellCenter(row: number, column: number): { x: number; y: number } | undefined {
    const screen = this.element.querySelector('.xterm-screen');
    if (screen === null) return undefined;
    const box = screen.getBoundingClientRect();
    const width = box.width / this.#terminal.cols;
    const height = box.height / this.#terminal.rows;
    const viewportRow = row - this.#terminal.buffer.active.viewportY;
    return { x: box.left + (column + 0.5) * width, y: box.top + (viewportRow + 0.5) * height };
  }

  /** Hidden views give up their WebGL context; browsers allow only ~16 at a time. */
  setVisible(visible: boolean): void {
    if (visible === this.#visible) return;
    this.#visible = visible;
    // A hidden view is not fitted; it is when shown again, and its pty keeps its size till then.
    this.#fit.active = visible;
    if (visible) {
      this.#webgl.attach();
      this.#fit.schedule();
      this.#resumeDrawing();
    } else {
      this.#webgl.detach();
    }
  }

  /**
   * Hidden panes sit outside the viewport, so xterm stops drawing them (see `.pane--hidden`).
   * It would resume once its IntersectionObserver reports the screen back, a frame or two
   * after the pane shows up blank; this resumes at once, so the first frame has the text.
   */
  #resumeDrawing(): void {
    const renderService = (this.#terminal as unknown as RenderServiceInternals)._core
      ?._renderService;
    renderService?._handleIntersectionChange?.({ isIntersecting: true });
  }

  /** Switches to WebGL if this view is visible and still on the DOM renderer. */
  upgradeRenderer(): void {
    if (this.#visible) this.#webgl.attach();
  }

  get rendererKind(): 'webgl' | 'dom' {
    return this.#webgl.attached ? 'webgl' : 'dom';
  }

  /** Pages of the glyph atlas this view draws with; views with the same font and colors share it. */
  atlasPages(): readonly HTMLCanvasElement[] {
    return this.#webgl.atlasPages();
  }

  /** Frames drawn so far (e2e tests check that hidden panes stay idle). */
  get renderCount(): number {
    return this.#renders;
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

  /** Drops the WebGL renderer, and with it this view's hold on its glyph atlas. */
  releaseWebgl(): void {
    this.#webgl.detach();
  }

  dispose(): void {
    this.#fit.dispose();
    for (const cleanup of this.#cleanup) cleanup();
    this.#focus.clear();
    this.#webgl.detach();
    this.#terminal.dispose();
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
}
