import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { TerminalSlot } from './TerminalSlot';

describe('TerminalSlot', () => {
  it('mounts the terminal into its element and tears it down on unmount', () => {
    const teardown = vi.fn();
    const mount = vi.fn<(element: HTMLElement) => () => void>(() => teardown);
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(<TerminalSlot mount={mount} />);
    });
    const slot = container.querySelector('[data-testid="terminal-slot"]');
    act(() => {
      root.unmount();
    });

    expect(mount).toHaveBeenCalledExactlyOnceWith(slot);
    expect(teardown).toHaveBeenCalledOnce();
  });
});
