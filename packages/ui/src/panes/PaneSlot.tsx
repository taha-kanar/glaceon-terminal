import type { SessionInfo } from '@glaceon/application';
import { useEffect, useRef, type ReactElement } from 'react';
import type { AppActions, TerminalSlotBinder } from '../app/app-model';
import { ExitOverlay } from './ExitOverlay';
import { rectStyle, type PlacedPane } from './pane-geometry';

export interface PaneSlotProps {
  readonly placed: PlacedPane;
  readonly info: SessionInfo | undefined;
  readonly dimmed: boolean;
  readonly bindSlot: TerminalSlotBinder;
  readonly actions: AppActions;
}

export function PaneSlot({ placed, info, dimmed, bindSlot, actions }: PaneSlotProps): ReactElement {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { pane } = placed;

  useEffect(() => {
    const element = terminalRef.current;
    if (element === null) return undefined;
    return bindSlot(pane, element);
  }, [pane, bindSlot]);

  const classes = ['pane'];
  if (!placed.visible) classes.push('pane--hidden');
  if (placed.focused) classes.push('pane--focused');
  if (dimmed) classes.push('pane--dimmed');

  return (
    <div
      className={classes.join(' ')}
      style={rectStyle(placed.rect)}
      data-testid="pane"
      data-pane={pane}
      data-focused={placed.focused}
      onMouseDown={() => {
        actions.focusPane(pane);
      }}
    >
      <div ref={terminalRef} className="pane__terminal" />
      {info?.exit !== undefined && placed.visible && (
        <ExitOverlay
          exit={info.exit}
          error={info.error}
          onRestart={() => {
            actions.restartPane(pane);
          }}
          onClose={() => {
            actions.dismissPane(pane);
          }}
        />
      )}
    </div>
  );
}
