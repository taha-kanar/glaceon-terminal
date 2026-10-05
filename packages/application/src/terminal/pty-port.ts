import type { Disposable, PtyExit, Result, SessionId, TerminalSize } from '@glaceon/domain';

export interface SpawnRequest {
  readonly sessionId: SessionId;
  readonly size: TerminalSize;
  readonly cwd?: string;
}

export interface SpawnedSession {
  readonly pid: number;
  /** Executable name of the shell, e.g. `zsh`. */
  readonly shell: string;
}

/** The program in the foreground of a terminal; `busy` when it is not the idle shell. */
export interface ForegroundProcess {
  readonly name: string;
  readonly busy: boolean;
}

export interface PtyError {
  readonly message: string;
}

/** Client-side access to pseudo terminals that live in another process. */
export interface PtyPort {
  spawn(request: SpawnRequest): Promise<Result<SpawnedSession, PtyError>>;
  write(sessionId: SessionId, data: string): void;
  resize(sessionId: SessionId, size: TerminalSize): void;
  kill(sessionId: SessionId): void;
  /** Reports output bytes the view has finished rendering (drives flow control). */
  acknowledge(sessionId: SessionId, bytes: number): void;
  /** Current working directory of the session's shell, when it can be determined. */
  cwd(sessionId: SessionId): Promise<string | undefined>;
  onData(sessionId: SessionId, listener: (chunk: Uint8Array) => void): Disposable;
  onExit(sessionId: SessionId, listener: (exit: PtyExit) => void): Disposable;
  /** Fires when the foreground process of the session changes (e.g. `zsh` → `vim`). */
  onProcess(sessionId: SessionId, listener: (process: ForegroundProcess) => void): Disposable;
}
