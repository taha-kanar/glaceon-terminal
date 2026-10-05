import { CommandIds } from '@glaceon/domain';
import type { ReactElement, ReactNode } from 'react';

export interface TitleBarProps {
  /** Keybinding label of a command, e.g. `⌘D`. */
  readonly labelFor: (command: string) => string | undefined;
  readonly runCommand: (command: string) => void;
  /** Shown at the right end, e.g. the process indicator. */
  readonly trailing?: ReactNode;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

interface Action {
  readonly command: string;
  readonly title: string;
  readonly testId?: string;
  readonly icon: ReactElement;
}

const ACTIONS: readonly Action[] = [
  {
    command: CommandIds.paneSplitRight,
    title: 'Split Right',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    command: CommandIds.paneSplitDown,
    title: 'Split Down',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    ),
  },
  {
    command: CommandIds.snippetsShow,
    title: 'Snippets',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    command: CommandIds.settingsOpen,
    title: 'Settings',
    testId: 'settings-button',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const withShortcut = (title: string, label: string | undefined): string =>
  label === undefined ? title : `${title} (${label})`;

/** Top row: tool buttons, a command bar that opens the palette, and status on the right. */
export function TitleBar({ labelFor, runCommand, trailing }: TitleBarProps): ReactElement {
  const paletteLabel = labelFor(CommandIds.paletteToggle);
  return (
    <header className="titlebar">
      <div className="titlebar__brand" aria-hidden="true">
        <svg viewBox="0 0 24 24" {...stroke}>
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      </div>
      <div className="titlebar__actions">
        {ACTIONS.map((action) => (
          <button
            key={action.command}
            type="button"
            className="titlebar__button"
            aria-label={action.title}
            title={withShortcut(action.title, labelFor(action.command))}
            data-testid={action.testId}
            onClick={() => {
              runCommand(action.command);
            }}
          >
            {action.icon}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="command-bar"
        data-testid="command-bar"
        title={withShortcut('Command Palette', paletteLabel)}
        onClick={() => {
          runCommand(CommandIds.paletteToggle);
        }}
      >
        <svg viewBox="0 0 24 24" {...stroke}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="command-bar__text">Search commands…</span>
        {paletteLabel !== undefined && <kbd className="command-bar__key">{paletteLabel}</kbd>}
      </button>
      <div className="titlebar__trailing">{trailing}</div>
    </header>
  );
}
