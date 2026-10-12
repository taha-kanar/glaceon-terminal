import { ratioFromPointer, type DividerRect } from '@glaceon/domain';
import type { ReactElement, RefObject } from 'react';
import { usePointerDrag } from '../hooks/use-pointer-drag';
import { dividerStyle } from './pane-geometry';

export interface DividerProps {
  readonly divider: DividerRect;
  readonly container: RefObject<HTMLElement | null>;
  readonly onRatio: (ratio: number) => void;
}

/**
 * A draggable boundary between two panes. While dragging, moves are tracked on the whole
 * document so fast drags over terminals (which re-render as they resize) are never lost.
 */
export function Divider({ divider, container, onRatio }: DividerProps): ReactElement {
  const startDrag = usePointerDrag();
  const pointerToRatio = (clientX: number, clientY: number): number | undefined => {
    const bounds = container.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width === 0 || bounds.height === 0) return undefined;
    return ratioFromPointer(divider, {
      x: (clientX - bounds.left) / bounds.width,
      y: (clientY - bounds.top) / bounds.height,
    });
  };

  return (
    <div
      className={`divider divider--${divider.axis}`}
      style={dividerStyle(divider)}
      data-testid="divider"
      role="separator"
      aria-orientation={divider.axis === 'row' ? 'vertical' : 'horizontal'}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const document = event.currentTarget.ownerDocument;
        const onMove = (move: PointerEvent): void => {
          const ratio = pointerToRatio(move.clientX, move.clientY);
          if (ratio !== undefined) onRatio(ratio);
        };
        startDrag(document, {
          move: onMove,
          up: onMove,
          cleanup: () => document.body.classList.remove(`dragging-${divider.axis}`),
        });
        document.body.classList.add(`dragging-${divider.axis}`);
      }}
    />
  );
}
