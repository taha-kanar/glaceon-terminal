import type { ThemeColorKey } from '@glaceon/application';
import { ANSI_COLOR_NAMES, type Theme } from '@glaceon/domain';
import type { ReactElement } from 'react';
import { TextInput } from './fields';
import type { ThemeEditorModel } from './settings-panel-model';

const BASE_KEYS: readonly { key: ThemeColorKey; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'accent', label: 'Accent' },
  { key: 'cursor', label: 'Cursor' },
  { key: 'cursorAccent', label: 'Cursor text' },
  { key: 'selection', label: 'Selection' },
];

const label = (name: string): string =>
  name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function colorOf(theme: Theme, key: ThemeColorKey): string {
  const { ansi, ...base } = theme.colors;
  return key in base ? base[key as keyof typeof base] : ansi[key as keyof typeof ansi];
}

export interface ThemeEditorViewProps {
  readonly draft: Theme;
  readonly editor: ThemeEditorModel;
  readonly onSave: () => void;
}

/** Color pickers for every theme color; the terminal behind previews changes live. */
export function ThemeEditorView({ draft, editor, onSave }: ThemeEditorViewProps): ReactElement {
  const picker = (key: ThemeColorKey, text: string): ReactElement => (
    <label key={key} className="color-field">
      <input
        type="color"
        name={key}
        value={colorOf(draft, key)}
        onChange={(event) => {
          editor.setColor(key, event.target.value);
        }}
      />
      <span>{text}</span>
    </label>
  );
  return (
    <div className="theme-editor" data-testid="theme-editor">
      <div className="theme-editor__name">
        <TextInput name="themeName" wide value={draft.name} onCommit={editor.rename} />
      </div>
      <h4 className="section__subtitle">Interface</h4>
      <div className="color-grid">{BASE_KEYS.map(({ key, label: text }) => picker(key, text))}</div>
      <h4 className="section__subtitle">ANSI colors</h4>
      <div className="color-grid color-grid--ansi">
        {ANSI_COLOR_NAMES.map((name) => picker(name, label(name)))}
      </div>
      <div className="section__footer">
        <button type="button" className="button" onClick={editor.cancel}>
          Cancel
        </button>
        <button type="button" className="button button--primary" onClick={onSave}>
          Save theme
        </button>
      </div>
    </div>
  );
}
