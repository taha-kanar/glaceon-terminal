import type { PtyProcess, PtyProcessFactory, PtySpawnOptions } from '@glaceon/application';
import { toDisposable, type Disposable, type PtyExit, type TerminalSize } from '@glaceon/domain';
import { spawn, type IPty } from 'node-pty';

const SPAWN_HELPER = 'spawn-helper';

/** Copies into an exactly sized buffer so structured cloning never drags a pooled slab along. */
function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
}

class NodePtyProcess implements PtyProcess {
  readonly #pty: IPty;
  #exited = false;

  constructor(pty: IPty) {
    this.#pty = pty;
    pty.onExit(() => {
      this.#exited = true;
    });
  }

  get pid(): number {
    return this.#pty.pid;
  }

  /** Empty while the shell has not started yet: node-pty's `spawn-helper` runs until the exec. */
  get foregroundProcess(): string {
    if (this.#exited) return '';
    try {
      const name = this.#pty.process;
      return name === SPAWN_HELPER ? '' : name;
    } catch {
      return '';
    }
  }

  pause(): void {
    if (!this.#exited) this.#pty.pause();
  }

  resume(): void {
    if (!this.#exited) this.#pty.resume();
  }

  write(data: string): void {
    if (!this.#exited) this.#pty.write(data);
  }

  resize(size: TerminalSize): void {
    if (!this.#exited) this.#pty.resize(size.cols, size.rows);
  }

  kill(): void {
    if (!this.#exited) this.#pty.kill();
  }

  onData(listener: (chunk: Uint8Array) => void): Disposable {
    // With `encoding: null` node-pty emits Buffers even though its typings say string.
    const subscription = this.#pty.onData((data: string | Uint8Array) => {
      listener(toBytes(data));
    });
    return toDisposable(() => subscription.dispose());
  }

  onExit(listener: (exit: PtyExit) => void): Disposable {
    const subscription = this.#pty.onExit(({ exitCode, signal }) => {
      listener(signal === undefined || signal === 0 ? { exitCode } : { exitCode, signal });
    });
    return toDisposable(() => subscription.dispose());
  }
}

export class NodePtyProcessFactory implements PtyProcessFactory {
  spawn(options: PtySpawnOptions): PtyProcess {
    const pty = spawn(options.file, [...options.args], {
      name: 'xterm-256color',
      cols: options.size.cols,
      rows: options.size.rows,
      cwd: options.cwd,
      env: { ...options.env },
      encoding: null,
    });
    return new NodePtyProcess(pty);
  }
}
