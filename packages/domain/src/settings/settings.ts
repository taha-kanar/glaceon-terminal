import type { KeybindingEntry } from '../keybinding/keybinding';
import { DEFAULT_THEME_ID } from '../theme/builtin-themes';

export type CursorStyle = 'block' | 'bar' | 'underline';

/** What happens to a pane whose shell exits: always close, close on exit code 0, or keep it. */
export type CloseOnExit = 'always' | 'clean' | 'never';

export interface Settings {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly theme: string;
  /** Opacity of the terminal background over the window's vibrancy, 0..1. */
  readonly backgroundOpacity: number;
  readonly cursorStyle: CursorStyle;
  readonly cursorBlink: boolean;
  readonly scrollback: number;
  readonly macOptionIsMeta: boolean;
  readonly copyOnSelect: boolean;
  readonly confirmCloseRunningProcess: boolean;
  readonly closeOnExit: CloseOnExit;
  /** Command template for opening `file:line:col` links, e.g. `code -g {file}:{line}:{col}`. */
  readonly editorCommand: string;
  readonly keybindings: readonly KeybindingEntry[];
}

export const FONT_SIZE_RANGE = { min: 6, max: 72 } as const;

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: '"JetBrains Mono", Menlo, monospace',
  fontSize: 13,
  lineHeight: 1.2,
  letterSpacing: 0,
  theme: DEFAULT_THEME_ID,
  backgroundOpacity: 0.85,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10_000,
  macOptionIsMeta: false,
  copyOnSelect: false,
  confirmCloseRunningProcess: true,
  closeOnExit: 'clean',
  editorCommand: 'code -g {file}:{line}:{col}',
  keybindings: [],
};

export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, Math.round(size)));
}

/** Settings as read from disk, before defaults are filled in. */
export type PartialSettings = Partial<Settings>;

export function withDefaults(partial: PartialSettings): Settings {
  return { ...DEFAULT_SETTINGS, ...partial };
}
