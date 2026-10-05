import type { Disposable, PtyExit, TerminalSize } from '@glaceon/domain';

export interface PtySpawnOptions {
  readonly file: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly size: TerminalSize;
}

/** One running pseudo terminal with its child process. */
export interface PtyProcess {
  readonly pid: number;
  write(data: string): void;
  resize(size: TerminalSize): void;
  kill(): void;
  onData(listener: (chunk: Uint8Array) => void): Disposable;
  onExit(listener: (exit: PtyExit) => void): Disposable;
}

export interface PtyProcessFactory {
  /** @throws when the process cannot be started. */
  spawn(options: PtySpawnOptions): PtyProcess;
}
