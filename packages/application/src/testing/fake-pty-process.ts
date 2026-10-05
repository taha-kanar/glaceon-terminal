import { Emitter, type Disposable, type PtyExit, type TerminalSize } from '@glaceon/domain';
import type { PtyProcess, PtyProcessFactory, PtySpawnOptions } from '../pty-host/pty-process';

export class FakePtyProcess implements PtyProcess {
  readonly writes: string[] = [];
  readonly resizes: TerminalSize[] = [];
  readonly data = new Emitter<Uint8Array>();
  readonly exit = new Emitter<PtyExit>();
  killed = false;
  paused = false;
  foregroundProcess = 'zsh';

  constructor(
    readonly pid: number,
    readonly options: PtySpawnOptions,
  ) {}

  write(data: string): void {
    this.writes.push(data);
  }

  resize(size: TerminalSize): void {
    this.resizes.push(size);
  }

  kill(): void {
    this.killed = true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  onData(listener: (chunk: Uint8Array) => void): Disposable {
    return this.data.on(listener);
  }

  onExit(listener: (exit: PtyExit) => void): Disposable {
    return this.exit.on(listener);
  }
}

export class FakePtyProcessFactory implements PtyProcessFactory {
  readonly processes: FakePtyProcess[] = [];
  failWith: Error | undefined;
  #nextPid = 1000;

  spawn(options: PtySpawnOptions): PtyProcess {
    if (this.failWith !== undefined) throw this.failWith;
    const ptyProcess = new FakePtyProcess(this.#nextPid++, options);
    this.processes.push(ptyProcess);
    return ptyProcess;
  }
}
