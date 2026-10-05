import {
  KeyedEmitter,
  ok,
  type Disposable,
  type PtyExit,
  type Result,
  type SessionId,
  type TerminalSize,
} from '@glaceon/domain';
import type { PtyError, PtyPort, SpawnedSession, SpawnRequest } from '../terminal/pty-port';

export class FakePtyPort implements PtyPort {
  readonly spawned: SpawnRequest[] = [];
  readonly writes: { sessionId: SessionId; data: string }[] = [];
  readonly resizes: { sessionId: SessionId; size: TerminalSize }[] = [];
  readonly killed: SessionId[] = [];
  nextSpawnResult: Result<SpawnedSession, PtyError> = ok({ pid: 4242 });

  readonly #data = new KeyedEmitter<SessionId, Uint8Array>();
  readonly #exit = new KeyedEmitter<SessionId, PtyExit>();

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
    return this.#data.size(sessionId) + this.#exit.size(sessionId);
  }
}
