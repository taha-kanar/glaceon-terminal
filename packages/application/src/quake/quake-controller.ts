import { parseChord, type Disposable, type KeyChord, type Settings } from '@glaceon/domain';
import { ObservableStore, type ReadableStore } from '../store/store';
import type {
  AppActivationPort,
  GlobalShortcutPort,
  QuakePanel,
  ScreenPort,
  ScreenRect,
} from './quake-ports';

export interface QuakeStatus {
  readonly registered: boolean;
  readonly error?: string;
}

export interface QuakeControllerDeps {
  readonly panel: () => QuakePanel;
  readonly screen: ScreenPort;
  readonly shortcuts: GlobalShortcutPort;
  readonly activation: AppActivationPort;
  readonly settings: ReadableStore<Settings>;
  readonly toAccelerator: (chord: KeyChord) => string;
}

/** Full width of the work area, `height` of it tall, at its top edge. */
export function quakeBounds(workArea: ScreenRect, height: number): ScreenRect {
  const share = Math.min(1, Math.max(0.2, height));
  return {
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: Math.round(workArea.height * share),
  };
}

/**
 * The drop-down terminal: a global shortcut shows it on the screen with the pointer and hides
 * it again; it also hides when it loses focus. Focus goes back to the app that had it.
 */
export class QuakeController {
  readonly #deps: QuakeControllerDeps;
  readonly #status = new ObservableStore<QuakeStatus>({ registered: false });
  #registered: string | undefined;
  #returnFocus = false;
  #subscription: Disposable | undefined;

  constructor(deps: QuakeControllerDeps) {
    this.#deps = deps;
  }

  get status(): ReadableStore<QuakeStatus> {
    return this.#status;
  }

  start(): void {
    this.#apply();
    this.#subscription = this.#deps.settings.subscribe(() => {
      this.#apply();
    });
  }

  dispose(): void {
    this.#subscription?.dispose();
    this.#unregister();
  }

  toggle(): void {
    const panel = this.#deps.panel();
    if (panel.visible && panel.focused) this.hide();
    else this.show();
  }

  show(): void {
    const panel = this.#deps.panel();
    if (!panel.visible) this.#returnFocus = !this.#deps.activation.isActive();
    const bounds = quakeBounds(
      this.#deps.screen.workAreaAtPointer(),
      this.#deps.settings.get().quakeHeight,
    );
    panel.show(bounds);
  }

  hide(): void {
    const panel = this.#deps.panel();
    if (!panel.visible) return;
    panel.hide();
    if (this.#returnFocus) this.#deps.activation.yieldFocus();
    this.#returnFocus = false;
  }

  /** Called when the panel loses focus (e.g. a click into another app). */
  blurred(): void {
    if (this.#deps.settings.get().quakeHideOnBlur) this.hide();
  }

  #apply(): void {
    const { quakeEnabled, quakeShortcut } = this.#deps.settings.get();
    const chord = parseChord(quakeShortcut);
    const accelerator = chord === undefined ? undefined : this.#deps.toAccelerator(chord);
    if (quakeEnabled && accelerator !== undefined && accelerator === this.#registered) return;
    this.#unregister();
    if (!quakeEnabled) {
      this.#status.set({ registered: false });
      return;
    }
    if (accelerator === undefined) {
      this.#status.set({ registered: false, error: `“${quakeShortcut}” is not a valid shortcut.` });
      return;
    }
    if (this.#deps.shortcuts.register(accelerator, () => this.toggle())) {
      this.#registered = accelerator;
      this.#status.set({ registered: true });
    } else {
      this.#status.set({
        registered: false,
        error: `${quakeShortcut} is already used by macOS or another app.`,
      });
    }
  }

  #unregister(): void {
    if (this.#registered === undefined) return;
    this.#deps.shortcuts.unregister(this.#registered);
    this.#registered = undefined;
  }
}
