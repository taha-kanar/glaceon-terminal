import type { ReactElement } from 'react';

export interface SettingsButtonProps {
  /** Keybinding shown in the tooltip, e.g. `⌘,`. */
  readonly label: string | undefined;
  readonly onClick: () => void;
}

/** Gear at the right end of the title bar. */
export function SettingsButton({ label, onClick }: SettingsButtonProps): ReactElement {
  return (
    <button
      type="button"
      className="titlebar-button"
      aria-label="Settings"
      title={label === undefined ? 'Settings' : `Settings (${label})`}
      data-testid="settings-button"
      onClick={onClick}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path
          fill="currentColor"
          d="M9.4 1.2 9.8 3a5.2 5.2 0 0 1 1.3.75l1.75-.6 1.4 2.43-1.38 1.23a5.3 5.3 0 0 1 0 1.5l1.38 1.23-1.4 2.43-1.75-.6a5.2 5.2 0 0 1-1.3.75l-.4 1.8H6.6l-.4-1.8a5.2 5.2 0 0 1-1.3-.75l-1.75.6-1.4-2.43 1.38-1.23a5.3 5.3 0 0 1 0-1.5L1.75 5.58l1.4-2.43 1.75.6A5.2 5.2 0 0 1 6.2 3l.4-1.8h2.8ZM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z"
        />
      </svg>
    </button>
  );
}
