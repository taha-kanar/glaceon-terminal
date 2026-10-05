import type { KeybindingEntry } from '../keybinding/keybinding';
import { BUILTIN_THEMES, DEFAULT_THEME_ID, resolveTheme } from '../theme/builtin-themes';
import type { Theme } from '../theme/theme';

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
  /** The drop-down terminal on a global shortcut. */
  readonly quakeEnabled: boolean;
  /** Global shortcut that shows and hides the quake window, e.g. `ctrl+\``. */
  readonly quakeShortcut: string;
  /** Height of the quake window as a share of the screen, 0.2..1. */
  readonly quakeHeight: number;
  readonly keybindings: readonly KeybindingEntry[];
  /** Themes made with the theme editor, selectable next to the built-in ones. */
  readonly customThemes: readonly Theme[];
}

export const FONT_SIZE_RANGE = { min: 6, max: 72 } as const;

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: '"JetBrains Mono", Menlo, monospace',
  fontSize: 13,
  lineHeight: 1.2,
  letterSpacing: 0,
  theme: DEFAULT_THEME_ID,
  backgroundOpacity: 0.72,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10_000,
  macOptionIsMeta: false,
  copyOnSelect: false,
  confirmCloseRunningProcess: true,
  closeOnExit: 'clean',
  editorCommand: 'code -g {file}:{line}:{col}',
  quakeEnabled: true,
  quakeShortcut: 'ctrl+`',
  quakeHeight: 0.45,
  keybindings: [],
  customThemes: [],
};

export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, Math.round(size)));
}

/** Settings as read from disk, before defaults are filled in. */
export type PartialSettings = Partial<Settings>;

export function withDefaults(partial: PartialSettings): Settings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

/** Built-in themes followed by custom ones; a custom theme may shadow a built-in id. */
export function availableThemes(settings: Pick<Settings, 'customThemes'>): readonly Theme[] {
  const custom = new Set(settings.customThemes.map((theme) => theme.id));
  return [...BUILTIN_THEMES.filter((theme) => !custom.has(theme.id)), ...settings.customThemes];
}

export function activeTheme(settings: Pick<Settings, 'theme' | 'customThemes'>): Theme {
  return resolveTheme(settings.theme, availableThemes(settings));
}
