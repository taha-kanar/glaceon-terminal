import type { SessionId } from '@glaceon/domain';
import type { PtyProcess } from './pty-process';

/** All live sessions in the pty host, regardless of which connection owns them. */
export class SessionRegistry {
  readonly #sessions = new Map<SessionId, PtyProcess>();

  get size(): number {
    return this.#sessions.size;
  }

  has(sessionId: SessionId): boolean {
    return this.#sessions.has(sessionId);
  }

  get(sessionId: SessionId): PtyProcess | undefined {
    return this.#sessions.get(sessionId);
  }

  add(sessionId: SessionId, process: PtyProcess): void {
    this.#sessions.set(sessionId, process);
  }

  remove(sessionId: SessionId): void {
    this.#sessions.delete(sessionId);
  }

  killAll(): void {
    for (const process of this.#sessions.values()) process.kill();
  }
}
