import type { SearchOptions, SearchState } from '@glaceon/application';
import { useEffect, useRef, type ReactElement } from 'react';

export interface SearchActions {
  readonly setQuery: (query: string) => void;
  readonly toggle: (option: keyof SearchOptions) => void;
  readonly next: () => void;
  readonly previous: () => void;
  readonly close: () => void;
}

const OPTIONS: readonly { key: keyof SearchOptions; label: string; title: string }[] = [
  { key: 'caseSensitive', label: 'Aa', title: 'Match case' },
  { key: 'wholeWord', label: 'ab', title: 'Whole word' },
  { key: 'regex', label: '.*', title: 'Regular expression' },
];

export function resultLabel(state: SearchState): string {
  const results = state.results;
  if (state.query === '' || results === undefined) return '';
  if (results.count === 0) return 'No results';
  const position = results.index < 0 ? '?' : String(results.index + 1);
  return `${position} of ${String(results.count)}`;
}

export function SearchBar({
  state,
  actions,
}: {
  readonly state: SearchState;
  readonly actions: SearchActions;
}): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [state.focusToken]);

  return (
    <div
      className="search"
      role="search"
      data-testid="search-bar"
      // Buttons keep the caret in the input so Enter and Escape keep working.
      onMouseDown={(event) => {
        if (event.target !== input.current) event.preventDefault();
      }}
    >
      <input
        ref={input}
        className="search__input"
        aria-label="Find"
        placeholder="Find"
        spellCheck={false}
        value={state.query}
        onChange={(event) => {
          actions.setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (event.shiftKey) actions.previous();
            else actions.next();
          } else if (event.key === 'Escape') {
            actions.close();
          } else return;
          event.preventDefault();
        }}
      />
      <span className="search__count" data-testid="search-count">
        {resultLabel(state)}
      </span>
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          className={
            state.options[option.key] ? 'search__option search__option--on' : 'search__option'
          }
          aria-pressed={state.options[option.key]}
          title={option.title}
          onClick={() => {
            actions.toggle(option.key);
          }}
        >
          {option.label}
        </button>
      ))}
      <button
        type="button"
        className="search__option"
        title="Previous (⇧↩)"
        onClick={actions.previous}
      >
        ↑
      </button>
      <button type="button" className="search__option" title="Next (↩)" onClick={actions.next}>
        ↓
      </button>
      <button type="button" className="search__option" title="Close (⎋)" onClick={actions.close}>
        ×
      </button>
    </div>
  );
}
