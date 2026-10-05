import {
  err,
  KeyedEmitter,
  ok,
  type Disposable,
  type PtyExit,
  type Result,
  type SessionId,
  type TerminalSize,
} from '@glaceon/domain';
import type {
  ForegroundProcess,
  PtyError,
  PtyPort,
  SpawnedSession,
  SpawnRequest,
} from '../terminal/pty-port';

export class FakePtyPort implements PtyPort {
  readonly spawned: SpawnRequest[] = [];
  readonly writes: { sessionId: SessionId; data: string }[] = [];
  readonly resizes: { sessionId: SessionId; size: TerminalSize }[] = [];
  readonly killed: SessionId[] = [];
  readonly acknowledged: { sessionId: SessionId; bytes: number }[] = [];
  readonly detachedSessions: SessionId[] = [];
  readonly attachedSessions: SessionId[] = [];
  /** Sessions `attach` accepts (with their pid). */
  readonly attachable = new Map<SessionId, number>();
  cwdResult: string | undefined = '/work';
  nextSpawnResult: Result<SpawnedSession, PtyError> = ok({ pid: 4242, shell: 'zsh' });

  readonly #data = new KeyedEmitter<SessionId, Uint8Array>();
  readonly #exit = new KeyedEmitter<SessionId, PtyExit>();
  readonly #process = new KeyedEmitter<SessionId, ForegroundProcess>();

  spawn(request: SpawnRequest): Promise<Result<SpawnedSession, PtyError>> {
    this.spawned.push(request);
    return Promise.resolve(this.nextSpawnResult);
  }

  write(sessionId: SessionId, data: string): void {
    this.writes.push({ sessionId, data });
  }

  resize(sessionId: SessionId, size: TerminalSize): void {
    this.resizes.push({ sessionId, size });
  }

  kill(sessionId: SessionId): void {
    this.killed.push(sessionId);
  }

  acknowledge(sessionId: SessionId, bytes: number): void {
    this.acknowledged.push({ sessionId, bytes });
  }

  cwd(): Promise<string | undefined> {
    return Promise.resolve(this.cwdResult);
  }

  detach(sessionId: SessionId): Promise<void> {
    this.detachedSessions.push(sessionId);
    this.attachable.set(sessionId, this.attachable.get(sessionId) ?? 4242);
    return Promise.resolve();
  }

  attach(sessionId: SessionId): Promise<Result<{ readonly pid: number }, PtyError>> {
    const pid = this.attachable.get(sessionId);
    if (pid === undefined) return Promise.resolve(err({ message: 'not detached' }));
    this.attachable.delete(sessionId);
    this.attachedSessions.push(sessionId);
    return Promise.resolve(ok({ pid }));
  }

  onProcess(sessionId: SessionId, listener: (process: ForegroundProcess) => void): Disposable {
    return this.#process.on(sessionId, listener);
  }

  emitProcess(sessionId: SessionId, name: string, busy = true): void {
    this.#process.emit(sessionId, { name, busy });
  }

  onData(sessionId: SessionId, listener: (chunk: Uint8Array) => void): Disposable {
    return this.#data.on(sessionId, listener);
  }

  onExit(sessionId: SessionId, listener: (exit: PtyExit) => void): Disposable {
    return this.#exit.on(sessionId, listener);
  }

  emitData(sessionId: SessionId, text: string): void {
    this.#data.emit(sessionId, new TextEncoder().encode(text));
  }

  emitExit(sessionId: SessionId, exit: PtyExit): void {
    this.#exit.emit(sessionId, exit);
  }

  listenerCount(sessionId: SessionId): number {
    return this.#data.size(sessionId) + this.#exit.size(sessionId) + this.#process.size(sessionId);
  }
}
