import type { Disposable, PtyExit, Result, SessionId, TerminalSize } from '@glaceon/domain';

export interface SpawnRequest {
  readonly sessionId: SessionId;
  readonly size: TerminalSize;
  readonly cwd?: string;
}

export interface SpawnedSession {
  readonly pid: number;
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
  onData(sessionId: SessionId, listener: (chunk: Uint8Array) => void): Disposable;
  onExit(sessionId: SessionId, listener: (exit: PtyExit) => void): Disposable;
}
