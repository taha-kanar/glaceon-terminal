import type { Disposable, Emitter, PtyExit, SessionId } from '@glaceon/domain';
import type { ForegroundProcess, PtyPort } from './pty-port';

export interface TerminalSessionResources {
  readonly pty: PtyPort;
  readonly wiring: Disposable;
  readonly exited: Emitter<PtyExit>;
  readonly process: Emitter<ForegroundProcess>;
}

/** A live connection between a terminal view and its shell. */
export class TerminalSession {
  readonly #resources: TerminalSessionResources;
  #closed = false;

  constructor(
    readonly id: SessionId,
    readonly spawned: { readonly pid: number; readonly shell: string },
    resources: TerminalSessionResources,
  ) {
    this.#resources = resources;
  }

  get pid(): number {
    return this.spawned.pid;
  }

  get isClosed(): boolean {
    return this.#closed;
  }

  onExit(listener: (exit: PtyExit) => void): Disposable {
    return this.#resources.exited.on(listener);
  }

  onProcess(listener: (process: ForegroundProcess) => void): Disposable {
    return this.#resources.process.on(listener);
  }

  cwd(): Promise<string | undefined> {
    return this.#closed ? Promise.resolve(undefined) : this.#resources.pty.cwd(this.id);
  }

  /**
   * Stops driving the view without killing the shell, which waits in the pty host for
   * another window. Resolves once all earlier output has reached the view.
   */
  async detach(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#resources.pty.detach(this.id);
    this.#resources.wiring.dispose();
  }

  /** Detaches from the shell and kills it. No exit event is delivered afterwards. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#resources.wiring.dispose();
    this.#resources.pty.kill(this.id);
  }
}
