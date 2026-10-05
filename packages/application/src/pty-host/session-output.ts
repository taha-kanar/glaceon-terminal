import type { PtyExit, SessionId } from '@glaceon/domain';
import type { ForegroundProcess } from '../terminal/pty-port';

/** Where a connection's session output is delivered (e.g. a MessagePort to a window). */
export interface SessionOutput {
  data(sessionId: SessionId, chunk: Uint8Array): void;
  exit(sessionId: SessionId, exit: PtyExit): void;
  process(sessionId: SessionId, process: ForegroundProcess): void;
}
