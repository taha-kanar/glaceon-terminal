import {
  DisposableStore,
  Emitter,
  type Disposable,
  type PaneId,
  type PtyExit,
  type SessionId,
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
  /** When the current foreground program started (epoch ms), while busy. */
  readonly busySince?: number;
  readonly exit?: PtyExit;
  readonly error?: string;
}

export type SessionInfoMap = ReadonlyMap<PaneId, SessionInfo>;

/** A running shell travelling from one window to another, with its last screen. */
export interface PaneTransfer {
  readonly sessionId: SessionId;
  readonly pid: number;
  readonly shell: string;
  readonly process?: string;
  readonly busy?: boolean;
  /** Serialized screen and scrollback (escape sequences) of the old view. */
  readonly snapshot?: string;
}

export interface PaneExit {
  readonly pane: PaneId;
  readonly exit: PtyExit;
}

interface PaneEntry {
  readonly view: TerminalView;
  readonly wiring: DisposableStore;
  session?: TerminalSession | undefined;
}

/** The shell of every pane in a window: start, restart, focus and teardown. */
export class SessionManager {
  readonly #sessions: TerminalSessionService;
  readonly #panes = new Map<PaneId, PaneEntry>();
  readonly #prepared = new Map<PaneId, OpenSessionOptions>();
  readonly #info = new ObservableStore<SessionInfoMap>(new Map());
  readonly #exited = new Emitter<PaneExit>();
  readonly #incoming = new Map<
    PaneId,
    { readonly transfer: PaneTransfer; readonly done: (ok: boolean) => void }
  >();
  #focusRequest: PaneId | undefined;

  readonly #now: () => number;

  constructor(sessions: TerminalSessionService, now: () => number = Date.now) {
    this.#sessions = sessions;
    this.#now = now;
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

  /** Binds a freshly created view to `pane` and starts its shell (or adopts an incoming one). */
  async open(pane: PaneId, view: TerminalView): Promise<void> {
    if (this.#panes.has(pane)) return;
    this.#panes.set(pane, { view, wiring: new DisposableStore() });
    const incoming = this.#incoming.get(pane);
    if (incoming === undefined) {
      await this.#start(pane);
      return;
    }
    this.#incoming.delete(pane);
    if (incoming.transfer.snapshot !== undefined) {
      view.restore(incoming.transfer.snapshot);
    }
    incoming.done(await this.#adopt(pane, incoming.transfer));
  }

  /**
   * Announces that `pane` will get a shell from another window instead of a new one. Resolves
   * once the pane's view exists and the shell is attached (false if attaching failed).
   */
  expect(pane: PaneId, transfer: PaneTransfer): Promise<boolean> {
    return new Promise((resolve) => {
      this.#incoming.set(pane, { transfer, done: resolve });
    });
  }

  /**
   * Lets go of the pane's shell without killing it, for another window to adopt. The pane
   * keeps its view and info until it is released. Undefined when there is no live shell.
   */
  async detach(pane: PaneId): Promise<PaneTransfer | undefined> {
    const entry = this.#panes.get(pane);
    const session = entry?.session;
    const info = this.#info.get().get(pane);
    if (entry === undefined || session === undefined || info?.exit !== undefined) return undefined;
    entry.session = undefined;
    entry.wiring.dispose();
    await session.detach();
    await entry.view.flush();
    return {
      sessionId: session.id,
      pid: session.pid,
      shell: session.spawned.shell,
      ...(info?.process === undefined ? {} : { process: info.process }),
      ...(info?.busy === undefined ? {} : { busy: info.busy }),
    };
  }

  /** Takes a detached shell back into its old pane (when moving it elsewhere failed). */
  async reattach(pane: PaneId, transfer: PaneTransfer): Promise<boolean> {
    return this.#panes.has(pane) ? this.#adopt(pane, transfer) : false;
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
    const incoming = this.#incoming.get(pane);
    this.#incoming.delete(pane);
    incoming?.done(false);
    if (this.#focusRequest === pane) this.#focusRequest = undefined;
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

  paste(pane: PaneId, text: string): void {
    this.#panes.get(pane)?.view.paste(text);
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
    this.#bindSession(pane, fresh, result.value);
  }

  async #adopt(pane: PaneId, transfer: PaneTransfer): Promise<boolean> {
    const entry = this.#panes.get(pane);
    if (entry === undefined) return false;
    entry.wiring.dispose();
    const wiring = new DisposableStore();
    const fresh: PaneEntry = { view: entry.view, wiring };
    this.#panes.set(pane, fresh);
    const result = await this.#sessions.attach(entry.view, transfer);
    if (this.#panes.get(pane) !== fresh) {
      if (result.ok) result.value.close();
      return false;
    }
    if (!result.ok) {
      this.#setInfo(pane, { error: result.error.message, exit: { exitCode: -1 } });
      return false;
    }
    this.#bindSession(pane, fresh, result.value);
    this.#patchInfo(pane, {
      ...(transfer.process === undefined ? {} : { process: transfer.process }),
      ...(transfer.busy === undefined ? {} : { busy: transfer.busy }),
    });
    return true;
  }

  #bindSession(pane: PaneId, entry: PaneEntry, session: TerminalSession): void {
    entry.session = session;
    this.#setInfo(pane, {
      pid: session.pid,
      shell: session.spawned.shell,
      process: session.spawned.shell,
    });
    entry.wiring.add(
      session.onProcess(({ name, busy }) => {
        this.#reportProcess(pane, name, busy);
      }),
    );
    entry.wiring.add(session.onExit((exit) => this.#handleExit(pane, exit)));
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

  /** A new foreground program restarts the clock; the idle shell clears it. */
  #reportProcess(pane: PaneId, name: string, busy: boolean): void {
    const current = this.#info.get().get(pane);
    if (current === undefined) return;
    const since = current.busy === true && current.process === name ? current.busySince : undefined;
    const next: { -readonly [K in keyof SessionInfo]: SessionInfo[K] } = {
      ...current,
      process: name,
      busy,
    };
    if (busy) next.busySince = since ?? this.#now();
    else delete next.busySince;
    this.#setInfo(pane, next);
  }

  #patchInfo(pane: PaneId, patch: Partial<SessionInfo>): void {
    const current = this.#info.get().get(pane);
    if (current === undefined) return;
    this.#setInfo(pane, { ...current, ...patch });
  }
}
