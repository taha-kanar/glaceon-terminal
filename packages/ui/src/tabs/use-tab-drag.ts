import type { TabId, Workspace } from '@glaceon/domain';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { usePointerDrag } from '../hooks/use-pointer-drag';

/** Pointer travel before a press on a tab becomes a drag. */
const DRAG_THRESHOLD = 5;
/** How far below the tab bar a tab must be dragged to tear it off. */
const TEAR_OFF_DISTANCE = 60;

export interface TabDropHandlers {
  readonly move: (tab: TabId, index: number) => void;
  readonly tearOff: (tab: TabId, screen: { readonly x: number; readonly y: number }) => void;
}

/** Released outside the window, or well below the tab bar. */
function isTearOff(list: HTMLElement, event: PointerEvent): boolean {
  const view = list.ownerDocument.defaultView;
  const outside =
    view !== null &&
    (event.clientX < 0 ||
      event.clientY < 0 ||
      event.clientX > view.innerWidth ||
      event.clientY > view.innerHeight);
  return outside || event.clientY > list.getBoundingClientRect().bottom + TEAR_OFF_DISTANCE;
}

export interface TabDrag {
  /**
   * The tab being dragged, where the insertion marker is (px from the list's left edge), and
   * whether letting go now tears the tab off into another window.
   */
  readonly state:
    { readonly tab: TabId; readonly marker: number; readonly tearing: boolean } | undefined;
  readonly onPointerDown: (tab: TabId, event: ReactPointerEvent) => void;
}

interface Drop {
  readonly index: number;
  readonly marker: number;
}

/** Where a tab dropped at `x` goes: an index into the tab list without the dragged tab. */
function dropAt(
  list: HTMLElement,
  workspace: Workspace,
  pointer: { readonly dragged: TabId; readonly x: number },
): Drop {
  const { dragged, x } = pointer;
  const others = workspace.tabs.filter((tab) => tab.id !== dragged).map((tab) => tab.id);
  const elements = [...list.querySelectorAll<HTMLElement>('[data-tab-id]')].filter(
    (element) => element.dataset['tabId'] !== dragged,
  );
  const origin = list.getBoundingClientRect().left;
  for (const element of elements) {
    const box = element.getBoundingClientRect();
    if (x < box.left + box.width / 2) {
      return {
        index: others.indexOf(element.dataset['tabId'] as TabId),
        marker: box.left - origin,
      };
    }
  }
  const last = elements.at(-1);
  if (last === undefined) return { index: others.length, marker: 0 };
  const lastIndex = others.indexOf(last.dataset['tabId'] as TabId);
  return { index: lastIndex + 1, marker: last.getBoundingClientRect().right - origin };
}

/** Drag-to-reorder for tabs, with pointer events so it works the same in tests and the app. */
export function useTabDrag(
  list: RefObject<HTMLElement | null>,
  workspace: Workspace,
  onDrop: TabDropHandlers,
): TabDrag {
  const startDrag = usePointerDrag();
  const [state, setState] = useState<TabDrag['state']>(undefined);
  const latest = useRef({ workspace, onDrop });
  useEffect(() => {
    latest.current = { workspace, onDrop };
  });

  const onPointerDown = (tab: TabId, event: ReactPointerEvent): void => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let drop: Drop | undefined;
    const onMove = (move: PointerEvent): void => {
      const element = list.current;
      if (element === null) return;
      const travelled = Math.max(Math.abs(move.clientX - startX), Math.abs(move.clientY - startY));
      if (drop === undefined && travelled < DRAG_THRESHOLD) return;
      drop = dropAt(element, latest.current.workspace, { dragged: tab, x: move.clientX });
      setState({ tab, marker: drop.marker, tearing: isTearOff(element, move) });
    };
    const onUp = (up: PointerEvent): void => {
      const element = list.current;
      if (drop === undefined || element === null) return;
      if (isTearOff(element, up))
        latest.current.onDrop.tearOff(tab, { x: up.screenX, y: up.screenY });
      else latest.current.onDrop.move(tab, drop.index);
    };
    startDrag(event.currentTarget.ownerDocument, {
      move: onMove,
      up: onUp,
      cleanup: () => setState(undefined),
    });
  };

  return { state, onPointerDown };
}
