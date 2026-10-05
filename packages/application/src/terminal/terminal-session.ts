import type { Disposable, SessionId } from '@glaceon/domain';
import type { PtyPort } from './pty-port';

/** A live connection between a terminal view and its shell. */
export class TerminalSession {
  readonly #pty: PtyPort;
  readonly #wiring: Disposable;
  #closed = false;

  constructor(
    readonly id: SessionId,
    readonly pid: number,
    resources: { readonly pty: PtyPort; readonly wiring: Disposable },
  ) {
    this.#pty = resources.pty;
    this.#wiring = resources.wiring;
  }

  get isClosed(): boolean {
    return this.#closed;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#wiring.dispose();
    this.#pty.kill(this.id);
  }
}
