import { useEffect, useRef } from 'react';

interface PointerDragHandlers {
  readonly move: (event: PointerEvent) => void;
  readonly up: (event: PointerEvent) => void;
  readonly cleanup: () => void;
}

/** Owns document listeners for one drag, including cancellation and component teardown. */
export function usePointerDrag(): (document: Document, handlers: PointerDragHandlers) => void {
  const active = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => active.current?.(), []);

  return (document, handlers) => {
    active.current?.();
    const view = document.defaultView;
    const cleanup = (): void => {
      document.removeEventListener('pointermove', handlers.move);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', cleanup);
      view?.removeEventListener('blur', cleanup);
      active.current = undefined;
      handlers.cleanup();
    };
    const onUp = (event: PointerEvent): void => {
      cleanup();
      handlers.up(event);
    };
    active.current = cleanup;
    document.addEventListener('pointermove', handlers.move);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', cleanup);
    view?.addEventListener('blur', cleanup);
  };
}
