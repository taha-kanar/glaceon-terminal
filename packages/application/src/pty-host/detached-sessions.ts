import type { Disposable, SessionId } from '@glaceon/domain';
import type { Scheduler } from '../ports/scheduler';
import { DetachBuffer } from './detach-buffer';
import type { HostSession } from './host-session';

interface Parked {
  readonly session: HostSession;
  readonly buffer: DetachBuffer;
  readonly expiry: Disposable;
}

/** How long a detached session waits for a window to claim it before it is killed. */
export const DETACHED_TTL_MS = 30_000;

/** Sessions between two windows: detached from one connection, not yet attached to another. */
export class DetachedSessions {
  readonly #scheduler: Scheduler;
  readonly #parked = new Map<SessionId, Parked>();

  constructor(scheduler: Scheduler) {
    this.#scheduler = scheduler;
  }

  get size(): number {
    return this.#parked.size;
  }

  park(sessionId: SessionId, session: HostSession): DetachBuffer {
    const buffer = new DetachBuffer();
    const expiry = this.#scheduler.setTimeout(() => {
      this.#parked.delete(sessionId);
      session.kill();
    }, DETACHED_TTL_MS);
    this.#parked.set(sessionId, { session, buffer, expiry });
    return buffer;
  }

  claim(sessionId: SessionId): { session: HostSession; buffer: DetachBuffer } | undefined {
    const parked = this.#parked.get(sessionId);
    if (parked === undefined) return undefined;
    this.#parked.delete(sessionId);
    parked.expiry.dispose();
    return { session: parked.session, buffer: parked.buffer };
  }

  killAll(): void {
    for (const { session, expiry } of this.#parked.values()) {
      expiry.dispose();
      session.kill();
    }
    this.#parked.clear();
  }
}
