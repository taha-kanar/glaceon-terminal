import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { click, render } from '../testing/render';
import { ConfirmDialog } from './ConfirmDialog';
import { ProblemsBanner } from './ProblemsBanner';

describe('ConfirmDialog', () => {
  it('focuses the confirm button and answers with buttons or Escape', () => {
    const onAnswer = vi.fn();
    const { container, unmount } = render(
      <ConfirmDialog
        request={{ title: 'Close pane?', message: 'vim is running.', confirmLabel: 'Close' }}
        onAnswer={onAnswer}
      />,
    );
    expect(document.activeElement?.textContent).toBe('Close');
    click(container.querySelector('.button--danger'));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    act(() => {
      container
        .querySelector('.dialog')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    unmount();
  });
});

describe('ProblemsBanner', () => {
  it('lists problems and opens the settings file', () => {
    const onOpen = vi.fn();
    const { container, unmount } = render(
      <ProblemsBanner problems={['fontSize: too big']} onOpenSettings={onOpen} />,
    );
    expect(container.textContent).toContain('fontSize: too big');
    click(container.querySelector('button'));
    expect(onOpen).toHaveBeenCalledOnce();
    unmount();
  });
});
