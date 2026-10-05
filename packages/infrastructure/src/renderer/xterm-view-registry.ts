import type { TerminalViewRegistry } from '@glaceon/application';
import { Emitter, type Disposable, type PaneId } from '@glaceon/domain';
import { XtermTerminalView, type XtermViewOptions } from './xterm-terminal-view';

export interface PaneFocusChange {
  readonly pane: PaneId;
  readonly focused: boolean;
}

interface Entry {
  readonly view: XtermTerminalView;
  readonly focus: Disposable;
}

/**
 * Owns the xterm instances of a window. Views live outside React: a slot element only borrows
 * the view's host element while mounted, so re-renders and layout changes never recreate a
 * terminal or lose its scrollback.
 */
export class XtermViewRegistry implements TerminalViewRegistry {
  readonly #document: Document;
  readonly #entries = new Map<PaneId, Entry>();
  readonly #hidden = new Set<PaneId>();
  readonly #focusChanged = new Emitter<PaneFocusChange>();
  #options: XtermViewOptions;

  constructor(document: Document, options: XtermViewOptions) {
    this.#document = document;
    this.#options = options;
  }

  get size(): number {
    return this.#entries.size;
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
    const view = new XtermTerminalView(host, this.#options);
    const focus = view.onFocusChange((focused) => this.#focusChanged.emit({ pane, focused }));
    this.#entries.set(pane, { view, focus });
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
    entry.view.dispose();
    entry.view.element.remove();
  }

  setOptions(options: XtermViewOptions): void {
    this.#options = options;
    for (const { view } of this.#entries.values()) view.setOptions(options);
  }

  onFocusChange(listener: (change: PaneFocusChange) => void): Disposable {
    return this.#focusChanged.on(listener);
  }
}
