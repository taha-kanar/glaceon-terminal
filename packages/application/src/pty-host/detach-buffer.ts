import type { PtyExit, SessionId } from '@glaceon/domain';
import type { ForegroundProcess } from '../terminal/pty-port';
import type { SessionOutput } from './session-output';

type BufferedEvent =
  | { readonly kind: 'data'; readonly chunk: Uint8Array }
  | { readonly kind: 'process'; readonly process: ForegroundProcess }
  | { readonly kind: 'exit'; readonly exit: PtyExit };

/**
 * Holds a session's output while it moves between windows. Flow control keeps it small:
 * nobody acknowledges buffered bytes, so the pty is paused at the high watermark.
 */
export class DetachBuffer implements SessionOutput {
  readonly #events: BufferedEvent[] = [];

  get size(): number {
    return this.#events.length;
  }

  data(_sessionId: SessionId, chunk: Uint8Array): void {
    this.#events.push({ kind: 'data', chunk });
  }

  exit(_sessionId: SessionId, exit: PtyExit): void {
    this.#events.push({ kind: 'exit', exit });
  }

  process(_sessionId: SessionId, process: ForegroundProcess): void {
    this.#events.push({ kind: 'process', process });
  }

  processes(): void {
    // Process trees are not replayed; the next monitor tick reports them to the new owner.
  }

  detached(): void {
    // Only owners are told about detaching.
  }

  /** Re-delivers the buffered events, in order, to the new owner. */
  replay(
    sessionId: SessionId,
    target: {
      readonly output: SessionOutput;
      readonly sent: (bytes: number) => void;
      readonly exited: (exit: PtyExit) => void;
    },
  ): void {
    for (const event of this.#events.splice(0)) {
      switch (event.kind) {
        case 'data':
          target.sent(event.chunk.byteLength);
          target.output.data(sessionId, event.chunk);
          break;
        case 'process':
          target.output.process(sessionId, event.process);
          break;
        case 'exit':
          target.output.exit(sessionId, event.exit);
          target.exited(event.exit);
          break;
      }
    }
  }
}
