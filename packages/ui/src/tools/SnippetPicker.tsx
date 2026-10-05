import { fuzzyFilter, renderSnippet, snippetVariables, type Snippet } from '@glaceon/domain';
import { useMemo, useState, type ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import { Highlighted } from '../palette/Highlighted';
import type { ToolsModel } from './tools-model';

export interface SnippetPickerProps {
  readonly model: ToolsModel;
  /** Open straight on this snippet's form (e.g. chosen from the command palette). */
  readonly initial: string | undefined;
  readonly onClose: () => void;
}

function SnippetForm({
  snippet,
  onPaste,
  onClose,
}: {
  readonly snippet: Snippet;
  readonly onPaste: (text: string) => void;
  readonly onClose: () => void;
}): ReactElement {
  const variables = useMemo(() => snippetVariables(snippet.body), [snippet.body]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v.name, v.defaultValue])),
  );
  const preview = renderSnippet(snippet.body, values);
  return (
    <form
      className="snippet-form"
      data-testid="snippet-form"
      onSubmit={(event) => {
        event.preventDefault();
        onPaste(preview);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="snippet-form__title">{snippet.name}</div>
      {variables.map((variable, index) => (
        <label key={variable.name} className="field">
          <span className="field__label">{variable.name}</span>
          <span className="field__control">
            <input
              className="input input--wide"
              name={variable.name}
              autoFocus={index === 0}
              spellCheck={false}
              value={values[variable.name] ?? ''}
              onChange={(event) => {
                setValues((current) => ({ ...current, [variable.name]: event.target.value }));
              }}
            />
          </span>
        </label>
      ))}
      <pre className="snippet-form__preview" data-testid="snippet-preview">
        {preview}
      </pre>
      <div className="snippet-form__actions">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button button--primary">
          Paste ↩
        </button>
      </div>
    </form>
  );
}

/** ⌘⇧S: fuzzy-find a snippet; snippets with placeholders get one form for all of them. */
export function SnippetPicker({ model, initial, onClose }: SnippetPickerProps): ReactElement {
  const { snippets, problem } = useStore(model.snippets);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [chosen, setChosen] = useState<Snippet | undefined>(() =>
    snippets.find((s) => s.name === initial),
  );
  const results = useMemo(
    () => fuzzyFilter(snippets, query, (snippet) => snippet.name),
    [snippets, query],
  );
  const current = Math.min(selected, Math.max(0, results.length - 1));
  const choose = (snippet: Snippet | undefined): void => {
    if (snippet === undefined) return;
    if (snippetVariables(snippet.body).length === 0) model.paste(snippet.body);
    else setChosen(snippet);
  };

  return (
    <div className="backdrop backdrop--top" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="Snippets"
        data-testid="snippet-picker"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        {chosen !== undefined ? (
          <SnippetForm snippet={chosen} onPaste={model.paste} onClose={onClose} />
        ) : (
          <>
            <input
              className="palette__input"
              autoFocus
              spellCheck={false}
              placeholder="Insert a snippet…"
              aria-label="Snippet"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown')
                  setSelected((current + 1) % Math.max(1, results.length));
                else if (event.key === 'ArrowUp')
                  setSelected((current - 1 + results.length) % Math.max(1, results.length));
                else if (event.key === 'Enter') choose(results[current]?.item);
                else if (event.key === 'Escape') onClose();
                else return;
                event.preventDefault();
              }}
            />
            {problem !== undefined && <div className="palette__problem">{problem}</div>}
            <ul className="palette__list" role="listbox">
              {results.map(({ item, match }, index) => (
                <li
                  key={item.name}
                  role="option"
                  aria-selected={index === current}
                  className={
                    index === current ? 'palette__item palette__item--selected' : 'palette__item'
                  }
                  data-testid="snippet"
                  onMouseMove={() => {
                    if (index !== current) setSelected(index);
                  }}
                  onClick={() => {
                    choose(item);
                  }}
                >
                  <span className="palette__label">
                    <Highlighted text={item.name} indices={match.indices} />
                  </span>
                  {item.description !== undefined && (
                    <span className="palette__hint">{item.description}</span>
                  )}
                </li>
              ))}
              {results.length === 0 && <li className="palette__empty">No snippets</li>}
            </ul>
            <button type="button" className="palette__footer" onClick={model.openSnippetsFile}>
              Edit snippets.json…
            </button>
          </>
        )}
      </div>
    </div>
  );
}
