import {
  DisposableStore,
  Emitter,
  type Disposable,
  type PaneId,
  type PtyExit,
} from '@glaceon/domain';
import { ObservableStore, type ReadableStore } from '../store/store';
import type { OpenSessionOptions, TerminalSessionService } from './terminal-session-service';
import type { TerminalSession } from './terminal-session';
import type { TerminalView } from './terminal-view';

/** What the UI knows about the shell running in a pane. */
export interface SessionInfo {
  readonly pid?: number;
  readonly shell?: string;
  /** Foreground process name, e.g. `vim`. Equal to `shell` when the prompt is idle. */
  readonly process?: string;
  /** Something other than the idle shell is in the foreground. */
  readonly busy?: boolean;
  readonly exit?: PtyExit;
  readonly error?: string;
}

export type SessionInfoMap = ReadonlyMap<PaneId, SessionInfo>;

export interface PaneExit {
  readonly pane: PaneId;
  readonly exit: PtyExit;
}

interface PaneEntry {
  readonly view: TerminalView;
  readonly wiring: DisposableStore;
  session?: TerminalSession;
}

/** The shell of every pane in a window: start, restart, focus and teardown. */
export class SessionManager {
  readonly #sessions: TerminalSessionService;
  readonly #panes = new Map<PaneId, PaneEntry>();
  readonly #prepared = new Map<PaneId, OpenSessionOptions>();
  readonly #info = new ObservableStore<SessionInfoMap>(new Map());
  readonly #exited = new Emitter<PaneExit>();
  #focusRequest: PaneId | undefined;

  constructor(sessions: TerminalSessionService) {
    this.#sessions = sessions;
  }

  get info(): ReadableStore<SessionInfoMap> {
    return this.#info;
  }

  onDidExit(listener: (event: PaneExit) => void): Disposable {
    return this.#exited.on(listener);
  }

  /** Options (such as the working directory) for the next shell started in `pane`. */
  prepare(pane: PaneId, options: OpenSessionOptions): void {
    this.#prepared.set(pane, options);
  }

  has(pane: PaneId): boolean {
    return this.#panes.has(pane);
  }

  /** Binds a freshly created view to `pane` and starts its shell. */
  async open(pane: PaneId, view: TerminalView): Promise<void> {
    if (this.#panes.has(pane)) return;
    this.#panes.set(pane, { view, wiring: new DisposableStore() });
    await this.#start(pane);
  }

  /** Starts a new shell in a pane whose shell has exited. */
  async restart(pane: PaneId): Promise<void> {
    if (!this.#panes.has(pane) || this.#info.get().get(pane)?.exit === undefined) return;
    await this.#start(pane);
  }

  /** Kills the pane's shell and forgets the pane. The view itself is owned by the caller. */
  release(pane: PaneId): void {
    const entry = this.#panes.get(pane);
    this.#prepared.delete(pane);
    if (entry === undefined) return;
    this.#panes.delete(pane);
    entry.wiring.dispose();
    entry.session?.close();
    this.#setInfo(pane, undefined);
  }

  focus(pane: PaneId): void {
    const entry = this.#panes.get(pane);
    if (entry === undefined) {
      this.#focusRequest = pane;
      return;
    }
    this.#focusRequest = undefined;
    entry.view.focus();
  }

  clear(pane: PaneId): void {
    this.#panes.get(pane)?.view.clear();
  }

  cwdOf(pane: PaneId): Promise<string | undefined> {
    return this.#panes.get(pane)?.session?.cwd() ?? Promise.resolve(undefined);
  }

  /** True when something other than the idle shell is in the foreground. */
  isBusy(pane: PaneId): boolean {
    const info = this.#info.get().get(pane);
    return info?.exit === undefined && info?.busy === true;
  }

  async #start(pane: PaneId): Promise<void> {
    const entry = this.#panes.get(pane);
    if (entry === undefined) return;
    entry.wiring.dispose();
    const wiring = new DisposableStore();
    const fresh: PaneEntry = { view: entry.view, wiring };
    this.#panes.set(pane, fresh);
    this.#setInfo(pane, {});

    const result = await this.#sessions.open(entry.view, this.#prepared.get(pane) ?? {});
    this.#prepared.delete(pane);
    if (this.#panes.get(pane) !== fresh) {
      if (result.ok) result.value.close();
      return;
    }
    if (!result.ok) {
      this.#setInfo(pane, { error: result.error.message, exit: { exitCode: -1 } });
      return;
    }
    const session = result.value;
    fresh.session = session;
    this.#setInfo(pane, {
      pid: session.pid,
      shell: session.spawned.shell,
      process: session.spawned.shell,
    });
    wiring.add(
      session.onProcess(({ name, busy }) => this.#patchInfo(pane, { process: name, busy })),
    );
    wiring.add(session.onExit((exit) => this.#handleExit(pane, exit)));
    if (this.#focusRequest === pane) this.focus(pane);
  }

  #handleExit(pane: PaneId, exit: PtyExit): void {
    const entry = this.#panes.get(pane);
    if (entry === undefined) return;
    this.#patchInfo(pane, { exit });
    // Enter in an exited pane starts a new shell.
    entry.wiring.add(
      entry.view.onInput((data) => {
        if (data === '\r') void this.restart(pane);
      }),
    );
    this.#exited.emit({ pane, exit });
  }

  #setInfo(pane: PaneId, info: SessionInfo | undefined): void {
    this.#info.update((map) => {
      const next = new Map(map);
      if (info === undefined) next.delete(pane);
      else next.set(pane, info);
      return next;
    });
  }

  #patchInfo(pane: PaneId, patch: Partial<SessionInfo>): void {
    const current = this.#info.get().get(pane);
    if (current === undefined) return;
    this.#setInfo(pane, { ...current, ...patch });
  }
}
