import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

/** Renders into a detached container; returns it and an unmount function. */
export function render(element: ReactElement): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export function click(element: Element | null): void {
  if (element === null) throw new Error('element not found');
  act(() => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  });
}
