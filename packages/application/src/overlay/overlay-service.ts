import { Emitter, type Disposable } from '@glaceon/domain';
import type { ContextKeys } from '../keybinding/context-keys';
import { ObservableStore, type ReadableStore } from '../store/store';

export type OverlayKind = 'palette' | 'settings';

export interface OverlayState {
  readonly kind: OverlayKind;
  /** e.g. the settings section to show. */
  readonly target?: string;
}

export const OVERLAY_OPEN_CONTEXT = 'overlayOpen';

/** The one modal panel (palette, settings) a window shows at a time. */
export class OverlayService {
  readonly #state = new ObservableStore<OverlayState | undefined>(undefined);
  readonly #closed = new Emitter<OverlayKind>();
  readonly #context: ContextKeys;

  constructor(context: ContextKeys) {
    this.#context = context;
  }

  get state(): ReadableStore<OverlayState | undefined> {
    return this.#state;
  }

  isOpen(kind: OverlayKind): boolean {
    return this.#state.get()?.kind === kind;
  }

  open(kind: OverlayKind, target?: string): void {
    this.#state.set(target === undefined ? { kind } : { kind, target });
    this.#context.set(OVERLAY_OPEN_CONTEXT, true);
    this.#context.set(`${kind}Open`, true);
  }

  toggle(kind: OverlayKind, target?: string): void {
    if (this.isOpen(kind)) this.close();
    else this.open(kind, target);
  }

  close(): void {
    const current = this.#state.get();
    if (current === undefined) return;
    this.#state.set(undefined);
    this.#context.set(OVERLAY_OPEN_CONTEXT, false);
    this.#context.set(`${current.kind}Open`, false);
    this.#closed.emit(current.kind);
  }

  /** Fires after an overlay closed, so focus can return to the terminal. */
  onDidClose(listener: (kind: OverlayKind) => void): Disposable {
    return this.#closed.on(listener);
  }
}
