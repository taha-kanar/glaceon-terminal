import type { Disposable, ProcessInfo, ProcessSignal } from '@glaceon/domain';

/** The process tree of one shell. */
export interface ShellProcesses {
  readonly shellPid: number;
  /** The shell first, then its descendants, parents before children. */
  readonly processes: readonly ProcessInfo[];
}

/** Renderer access to the pty host's process monitor. */
export interface ProcessMonitorPort {
  /** Process trees of this window's shells, while subscribed (the host polls only then). */
  watchProcesses(listener: (shells: readonly ShellProcesses[]) => void): Disposable;
  signal(pid: number, signal: ProcessSignal): void;
}
