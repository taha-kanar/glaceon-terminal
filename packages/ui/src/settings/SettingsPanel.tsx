import { useEffect, useState, type ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import type { SettingsSection } from './section';
import type { SettingsPanelModel } from './settings-panel-model';

export interface SettingsPanelProps {
  readonly model: SettingsPanelModel;
  readonly sections: readonly SettingsSection[];
  readonly initialSection: string | undefined;
  readonly onClose: () => void;
}

/** A drawer on the right, so the terminal stays visible as a live preview. */
export function SettingsPanel({
  model,
  sections,
  initialSection,
  onClose,
}: SettingsPanelProps): ReactElement {
  const settings = useStore(model.settings);
  const [active, setActive] = useState(
    sections.some((s) => s.id === initialSection) ? initialSection : sections[0]?.id,
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const section = sections.find((s) => s.id === active) ?? sections[0];
  // Escape closes the panel wherever focus is (after recording a key it may be on <body>).
  useEffect(() => {
    const view = document.defaultView;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    view?.addEventListener('keydown', onKeyDown);
    return () => {
      view?.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);
  const report = (result: { readonly ok: boolean; readonly error?: string }): void => {
    setError(result.ok ? undefined : result.error);
  };

  return (
    <div className="drawer-layer" data-testid="settings-panel" onMouseDown={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-label="Settings"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="drawer__header">
          <nav className="drawer__tabs" role="tablist">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === section?.id}
                className={s.id === section?.id ? 'drawer__tab drawer__tab--active' : 'drawer__tab'}
                onClick={() => {
                  setActive(s.id);
                }}
              >
                {s.title}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="drawer__close"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {error !== undefined && (
          <div className="drawer__error" role="alert">
            {error}
          </div>
        )}
        <div className="drawer__body">{section?.render({ model, settings, report })}</div>
      </aside>
    </div>
  );
}
