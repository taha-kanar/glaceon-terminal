import type { PaletteItem } from '@glaceon/application';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Highlighted } from './Highlighted';

export interface CommandPaletteProps {
  readonly items: (query: string) => readonly PaletteItem[];
  readonly onRun: (item: PaletteItem) => void;
  readonly onClose: () => void;
}

export function CommandPalette({ items, onRun, onClose }: CommandPaletteProps): ReactElement {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const results = useMemo(() => items(query), [items, query]);
  const current = Math.min(selected, Math.max(0, results.length - 1));

  useEffect(() => {
    list.current?.children[current]?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const move = (delta: number): void => {
    if (results.length === 0) return;
    setSelected((current + delta + results.length) % results.length);
  };

  return (
    <div className="backdrop backdrop--top" data-testid="palette" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="Command palette"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <input
          className="palette__input"
          autoFocus
          spellCheck={false}
          placeholder="Type a command…"
          value={query}
          aria-label="Command"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') move(1);
            else if (event.key === 'ArrowUp') move(-1);
            else if (event.key === 'Escape') onClose();
            else if (event.key === 'Enter') {
              const item = results[current];
              if (item !== undefined) onRun(item);
            } else return;
            event.preventDefault();
          }}
        />
        <ul ref={list} className="palette__list" role="listbox">
          {results.map((item, index) => (
            <li
              key={item.invocation.id}
              role="option"
              aria-selected={index === current}
              className={
                index === current ? 'palette__item palette__item--selected' : 'palette__item'
              }
              onMouseMove={() => {
                if (index !== current) setSelected(index);
              }}
              onClick={() => {
                onRun(item);
              }}
            >
              <span className="palette__label">
                <Highlighted text={item.label} indices={item.match.indices} />
              </span>
              {item.keybinding !== undefined && (
                <kbd className="palette__key">{item.keybinding}</kbd>
              )}
            </li>
          ))}
          {results.length === 0 && <li className="palette__empty">No matching commands</li>}
        </ul>
      </div>
    </div>
  );
}
