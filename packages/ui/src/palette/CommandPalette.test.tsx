import type { PaletteItem } from '@glaceon/application';
import { fuzzyFilter } from '@glaceon/domain';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '../testing/render';
import { CommandPalette } from './CommandPalette';

const all = ['Pane: Split Right', 'Pane: Split Down', 'Tab: New Tab'];
const items = (query: string): PaletteItem[] =>
  fuzzyFilter(all, query, (s) => s).map(({ item, match }) => ({
    invocation: { id: item, title: item, command: item },
    label: item,
    match,
    ...(item === 'Tab: New Tab' ? { keybinding: '⌘T' } : {}),
  }));

function key(target: Element, name: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  });
}

function type(input: HTMLInputElement, value: string): void {
  act(() => {
    // Bypass React's value tracking so the change event fires like a real keystroke.
    Reflect.set(HTMLInputElement.prototype, 'value', value, input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('CommandPalette', () => {
  it('filters, highlights, navigates with arrows and runs with Enter', () => {
    const onRun = vi.fn();
    const { container, unmount } = render(
      <CommandPalette items={items} onRun={onRun} onClose={vi.fn()} />,
    );
    const input = container.querySelector('input')!;
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(container.textContent).toContain('⌘T');

    type(input, 'split');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(container.querySelector('mark')).not.toBeNull();
    const labels = [...container.querySelectorAll('[role="option"]')].map((o) => o.textContent);
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(onRun).toHaveBeenLastCalledWith(expect.objectContaining({ label: labels[1] }));
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(onRun).toHaveBeenLastCalledWith(expect.objectContaining({ label: labels[0] }));

    type(input, 'zzz');
    expect(container.textContent).toContain('No matching commands');
    key(input, 'Enter');
    expect(onRun).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('closes on Escape and on a click outside', () => {
    const onClose = vi.fn();
    const { container, unmount } = render(
      <CommandPalette items={items} onRun={vi.fn()} onClose={onClose} />,
    );
    key(container.querySelector('input')!, 'Escape');
    act(() => {
      container
        .querySelector('[data-testid="palette"]')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();
  });
});
