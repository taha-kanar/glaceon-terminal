import type { SessionInfo } from '@glaceon/application';
import type { PaneId } from '@glaceon/domain';
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';
import type { AppActions, TerminalSlotBinder } from '../app/app-model';
import { ExitOverlay } from './ExitOverlay';
import { rectStyle, type PlacedPane } from './pane-geometry';

/** Drags from other apps a pane takes: files from Finder, or text. */
const accepts = (event: DragEvent): boolean =>
  event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/plain');

export interface PaneSlotProps {
  readonly placed: PlacedPane;
  readonly info: SessionInfo | undefined;
  readonly dimmed: boolean;
  /** Shows the grip that drags the pane onto another one. */
  readonly draggable: boolean;
  readonly dragging: boolean;
  readonly onGrab: (pane: PaneId, event: PointerEvent) => void;
  readonly onContextMenu: (pane: PaneId, event: MouseEvent) => void;
  readonly bindSlot: TerminalSlotBinder;
  readonly actions: AppActions;
}

export function PaneSlot(props: PaneSlotProps): ReactElement {
  const { placed, info, dimmed, bindSlot, actions } = props;
  const terminalRef = useRef<HTMLDivElement>(null);
  const { pane } = placed;
  // Counted because enter/leave also fire when the pointer crosses the pane's children.
  const [dragDepth, setDragDepth] = useState(0);
  const takesDrops = info?.exit === undefined;

  useEffect(() => {
    const element = terminalRef.current;
    if (element === null) return undefined;
    return bindSlot(pane, element);
  }, [pane, bindSlot]);

  const classes = ['pane'];
  if (!placed.visible) classes.push('pane--hidden');
  if (placed.focused) classes.push('pane--focused');
  if (dimmed) classes.push('pane--dimmed');
  if (props.dragging) classes.push('pane--dragging');
  if (dragDepth > 0) classes.push('pane--file-drop');

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
      onContextMenu={(event) => {
        props.onContextMenu(pane, event);
      }}
      onDragEnter={(event) => {
        if (!takesDrops || !accepts(event)) return;
        event.preventDefault();
        setDragDepth((depth) => depth + 1);
      }}
      onDragOver={(event) => {
        if (!takesDrops || !accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        setDragDepth((depth) => Math.max(0, depth - 1));
      }}
      onDrop={(event) => {
        setDragDepth(0);
        if (!takesDrops || !accepts(event)) return;
        event.preventDefault();
        actions.dropOnPane(pane, {
          files: Array.from(event.dataTransfer.files),
          text: event.dataTransfer.getData('text/plain'),
        });
      }}
    >
      <div ref={terminalRef} className="pane__terminal" />
      {props.draggable && (
        <div
          className="pane__grip"
          title="Drag to move this pane"
          data-testid="pane-grip"
          onPointerDown={(event) => {
            props.onGrab(pane, event);
          }}
        />
      )}
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
