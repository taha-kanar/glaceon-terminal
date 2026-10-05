import { asPaneId } from '@glaceon/domain';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { click, render } from '../testing/render';
import { resultLabel, SearchBar } from './SearchBar';

const state = {
  pane: asPaneId('p'),
  query: 'err',
  options: { caseSensitive: true, regex: false, wholeWord: false },
  results: { index: 1, count: 5 },
  focusToken: 1,
};

const actions = () => ({
  setQuery: vi.fn(),
  toggle: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  close: vi.fn(),
});

describe('SearchBar', () => {
  it('shows the result position and toggled options', () => {
    const { container, unmount } = render(<SearchBar state={state} actions={actions()} />);
    expect(container.querySelector('[data-testid="search-count"]')?.textContent).toBe('2 of 5');
    expect(container.querySelector('[aria-pressed="true"]')?.textContent).toBe('Aa');
    expect(document.activeElement).toBe(container.querySelector('input'));
    unmount();
  });

  it('labels empty and unmatched searches', () => {
    expect(resultLabel({ ...state, results: { index: -1, count: 0 } })).toBe('No results');
    expect(resultLabel({ ...state, query: '' })).toBe('');
    expect(resultLabel({ ...state, results: { index: -1, count: 3 } })).toBe('? of 3');
  });

  it('maps keys and buttons to actions', () => {
    const spy = actions();
    const { container, unmount } = render(<SearchBar state={state} actions={spy} />);
    const input = container.querySelector('input')!;
    const press = (key: string, shiftKey = false) => {
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
      });
    };
    press('Enter');
    press('Enter', true);
    press('Escape');
    click(container.querySelector('[title="Regular expression"]'));
    expect(spy.next).toHaveBeenCalledOnce();
    expect(spy.previous).toHaveBeenCalledOnce();
    expect(spy.close).toHaveBeenCalledOnce();
    expect(spy.toggle).toHaveBeenCalledWith('regex');
    unmount();
  });
});
