import type { ProcessInfo, PtyExit, SessionId } from '@glaceon/domain';
import type { ForegroundProcess } from '../terminal/pty-port';

/** Where a connection's session output is delivered (e.g. a MessagePort to a window). */
export interface SessionOutput {
  data(sessionId: SessionId, chunk: Uint8Array): void;
  exit(sessionId: SessionId, exit: PtyExit): void;
  process(sessionId: SessionId, process: ForegroundProcess): void;
  /** Process trees of the connection's sessions (only while the client monitors them). */
  processes(reports: readonly SessionProcesses[]): void;
  /** The session was detached; all of its earlier output has been delivered. */
  detached(sessionId: SessionId): void;
}

export interface SessionProcesses {
  readonly sessionId: SessionId;
  /** The shell's pid; the first entry of `processes` when it is still running. */
  readonly pid: number;
  readonly processes: readonly ProcessInfo[];
}
