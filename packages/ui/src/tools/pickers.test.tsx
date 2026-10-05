import { ObservableStore } from '@glaceon/application';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { click, render } from '../testing/render';
import { ClipboardPicker } from './ClipboardPicker';
import { SnippetPicker } from './SnippetPicker';
import type { SnippetsView, ToolsModel } from './tools-model';

function key(target: Element, name: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  });
}

function type(input: HTMLInputElement, value: string): void {
  act(() => {
    Reflect.set(HTMLInputElement.prototype, 'value', value, input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function model(ring: readonly string[], snippets: SnippetsView): ToolsModel {
  return {
    ring: new ObservableStore(ring),
    snippets: new ObservableStore(snippets),
    paste: vi.fn(),
    openSnippetsFile: vi.fn(),
  };
}

describe('ClipboardPicker', () => {
  it('pastes by number, by arrows + Enter and closes on Escape', () => {
    const tools = model(['first', 'second\nline', 'third'], { snippets: [] });
    const onClose = vi.fn();
    const { container, unmount } = render(<ClipboardPicker model={tools} onClose={onClose} />);
    const input = container.querySelector('input')!;
    expect(container.querySelectorAll('[data-testid="clip"]')).toHaveLength(3);
    expect(container.textContent).toContain('second line');
    key(input, '2');
    expect(tools.paste).toHaveBeenLastCalledWith('second\nline');
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(tools.paste).toHaveBeenLastCalledWith('third');
    key(input, '9');
    expect(tools.paste).toHaveBeenCalledTimes(2);
    key(input, 'Escape');
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('says so when nothing was copied', () => {
    const { container, unmount } = render(
      <ClipboardPicker model={model([], { snippets: [] })} onClose={vi.fn()} />,
    );
    expect(container.textContent).toContain('Nothing copied yet');
    unmount();
  });
});

describe('SnippetPicker', () => {
  const snippets = [
    { name: 'git log', body: 'git log --oneline' },
    { name: 'ssh', body: 'ssh {{user:root}}@{{host}}', description: 'connect' },
  ];

  it('filters, pastes plain snippets at once and shows the problem', () => {
    const tools = model([], { snippets, problem: 'bad json' });
    const { container, unmount } = render(
      <SnippetPicker model={tools} initial={undefined} onClose={vi.fn()} />,
    );
    expect(container.textContent).toContain('bad json');
    const input = container.querySelector('input')!;
    type(input, 'glog');
    expect(container.querySelectorAll('[data-testid="snippet"]')).toHaveLength(1);
    key(input, 'Enter');
    expect(tools.paste).toHaveBeenCalledWith('git log --oneline');
    click(container.querySelector('.palette__footer'));
    expect(tools.openSnippetsFile).toHaveBeenCalled();
    unmount();
  });

  it('asks for every variable in one form, prefilled with defaults', () => {
    const tools = model([], { snippets });
    const { container, unmount } = render(
      <SnippetPicker model={tools} initial="ssh" onClose={vi.fn()} />,
    );
    const inputs = [...container.querySelectorAll<HTMLInputElement>('form input')];
    expect(inputs.map((i) => i.value)).toEqual(['root', '']);
    type(inputs[1]!, 'example.com');
    expect(container.querySelector('[data-testid="snippet-preview"]')?.textContent).toBe(
      'ssh root@example.com',
    );
    act(() => {
      container.querySelector('form')!.requestSubmit();
    });
    expect(tools.paste).toHaveBeenCalledWith('ssh root@example.com');
    unmount();
  });

  it('opens the form when a snippet with variables is chosen from the list', () => {
    const tools = model([], { snippets });
    const { container, unmount } = render(
      <SnippetPicker model={tools} initial={undefined} onClose={vi.fn()} />,
    );
    click(container.querySelectorAll('[data-testid="snippet"]')[1] ?? null);
    expect(container.querySelector('[data-testid="snippet-form"]')).not.toBeNull();
    expect(tools.paste).not.toHaveBeenCalled();
    unmount();
  });
});
