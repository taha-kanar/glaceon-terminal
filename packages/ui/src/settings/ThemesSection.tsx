import { availableThemes } from '@glaceon/domain';
import type { ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import type { SectionProps } from './section';
import { ThemeEditorView } from './ThemeEditorView';
import { ThemeSwatch } from './ThemeSwatch';

export function ThemesSection({ model, settings, report }: SectionProps): ReactElement {
  const { themes: editor } = model;
  const draft = useStore(editor.draft);
  if (draft !== undefined) {
    return (
      <ThemeEditorView
        draft={draft}
        editor={editor}
        onSave={() => {
          void editor.save().then(report);
        }}
      />
    );
  }
  const custom = new Set(settings.customThemes.map((theme) => theme.id));
  return (
    <div className="section">
      <div className="theme-grid" role="radiogroup" aria-label="Theme">
        {availableThemes(settings).map((theme) => {
          const selected = theme.id === settings.theme;
          return (
            <div
              key={theme.id}
              className={selected ? 'theme-card theme-card--selected' : 'theme-card'}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className="theme-card__pick"
                data-testid={`theme-${theme.id}`}
                onClick={() => {
                  void model.update('theme', theme.id).then(report);
                }}
              >
                <ThemeSwatch theme={theme} />
                <span className="theme-card__name">{theme.name}</span>
              </button>
              <span className="theme-card__actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    editor.begin(theme.id);
                  }}
                >
                  {custom.has(theme.id) ? 'Edit' : 'Customize'}
                </button>
                {custom.has(theme.id) && (
                  <button
                    type="button"
                    className="link-button link-button--danger"
                    onClick={() => {
                      void editor.remove(theme.id).then(report);
                    }}
                  >
                    Delete
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
