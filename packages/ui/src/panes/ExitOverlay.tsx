import type { PtyExit } from '@glaceon/domain';
import type { ReactElement } from 'react';

export interface ExitOverlayProps {
  readonly exit: PtyExit;
  readonly error: string | undefined;
  readonly onRestart: () => void;
  readonly onClose: () => void;
}

export function exitMessage(exit: PtyExit, error: string | undefined): string {
  if (error !== undefined) return `Shell failed to start: ${error}`;
  if (exit.signal !== undefined) return `Process terminated by signal ${String(exit.signal)}`;
  return `Process exited with code ${String(exit.exitCode)}`;
}

export function ExitOverlay({ exit, error, onRestart, onClose }: ExitOverlayProps): ReactElement {
  return (
    <div
      className="exit-overlay"
      role="status"
      data-testid="exit-overlay"
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      <span className="exit-overlay__message">{exitMessage(exit, error)}</span>
      <button type="button" className="button button--primary" onClick={onRestart}>
        Restart <kbd>↩</kbd>
      </button>
      <button type="button" className="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
