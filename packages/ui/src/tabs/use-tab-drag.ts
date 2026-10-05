import type { TabId, Workspace } from '@glaceon/domain';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

/** Pointer travel before a press on a tab becomes a drag. */
const DRAG_THRESHOLD = 5;

export interface TabDrag {
  /** The tab being dragged and where the insertion marker is (px from the list's left edge). */
  readonly state: { readonly tab: TabId; readonly marker: number } | undefined;
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
  onDrop: (tab: TabId, index: number) => void,
): TabDrag {
  const [state, setState] = useState<TabDrag['state']>(undefined);
  const latest = useRef({ workspace, onDrop });
  useEffect(() => {
    latest.current = { workspace, onDrop };
  });

  const onPointerDown = (tab: TabId, event: ReactPointerEvent): void => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    let drop: Drop | undefined;
    const onMove = (move: PointerEvent): void => {
      const element = list.current;
      if (element === null) return;
      if (drop === undefined && Math.abs(move.clientX - startX) < DRAG_THRESHOLD) return;
      drop = dropAt(element, latest.current.workspace, { dragged: tab, x: move.clientX });
      setState({ tab, marker: drop.marker });
    };
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setState(undefined);
      if (drop !== undefined) latest.current.onDrop(tab, drop.index);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return { state, onPointerDown };
}
