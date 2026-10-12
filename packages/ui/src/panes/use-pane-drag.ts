import { dropZoneAt, type DropZone, type PaneId, type Rect } from '@glaceon/domain';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { usePointerDrag } from '../hooks/use-pointer-drag';
import type { PlacedPane } from './pane-geometry';

export interface PaneDropTarget {
  readonly pane: PaneId;
  readonly zone: DropZone;
  /** The area the dragged pane would take (unit coordinates of the pane area). */
  readonly preview: Rect;
}

export interface PaneDrag {
  readonly source: PaneId | undefined;
  readonly target: PaneDropTarget | undefined;
  readonly onPointerDown: (pane: PaneId, event: ReactPointerEvent) => void;
}

/** The half of `rect` facing `zone` (all of it for a swap). */
export function zonePreview(rect: Rect, zone: DropZone): Rect {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  switch (zone) {
    case 'left':
      return { ...rect, width: halfWidth };
    case 'right':
      return { ...rect, x: rect.x + halfWidth, width: halfWidth };
    case 'top':
      return { ...rect, height: halfHeight };
    case 'bottom':
      return { ...rect, y: rect.y + halfHeight, height: halfHeight };
    case 'center':
      return rect;
  }
}

const contains = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

/** Drag a pane by its grip onto another pane: edges split it, the center swaps them. */
export function usePaneDrag(
  container: RefObject<HTMLElement | null>,
  panes: readonly PlacedPane[],
  onDrop: (source: PaneId, target: PaneId, zone: DropZone) => void,
): PaneDrag {
  const startDrag = usePointerDrag();
  const [source, setSource] = useState<PaneId | undefined>(undefined);
  const [target, setTarget] = useState<PaneDropTarget | undefined>(undefined);
  const latest = useRef({ panes, onDrop });
  useEffect(() => {
    latest.current = { panes, onDrop };
  });

  const onPointerDown = (pane: PaneId, event: ReactPointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    let current: PaneDropTarget | undefined;
    const onMove = (move: PointerEvent): void => {
      const box = container.current?.getBoundingClientRect();
      if (box === undefined || box.width === 0 || box.height === 0) return;
      const x = (move.clientX - box.left) / box.width;
      const y = (move.clientY - box.top) / box.height;
      const over = latest.current.panes.find(
        (placed) => placed.visible && placed.pane !== pane && contains(placed.rect, x, y),
      );
      if (over === undefined) current = undefined;
      else {
        const zone = dropZoneAt(over.rect, { x, y });
        current = { pane: over.pane, zone, preview: zonePreview(over.rect, zone) };
      }
      setTarget(current);
    };
    const onUp = (): void => {
      if (current !== undefined) latest.current.onDrop(pane, current.pane, current.zone);
    };
    startDrag(event.currentTarget.ownerDocument, {
      move: onMove,
      up: onUp,
      cleanup: () => {
        setSource(undefined);
        setTarget(undefined);
      },
    });
    setSource(pane);
  };

  return { source, target, onPointerDown };
}
