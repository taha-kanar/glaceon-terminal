import { rgba, type Theme } from '@glaceon/domain';
import type { ITheme } from '@xterm/xterm';

/**
 * xterm colors for a theme. The terminal background is fully transparent: the window's tinted
 * surface (theme background at the configured opacity, over vibrancy) shows through.
 */
export function toXtermTheme(theme: Theme): ITheme {
  const { colors } = theme;
  return {
    background: '#00000000',
    foreground: colors.foreground,
    cursor: colors.cursor,
    cursorAccent: colors.cursorAccent,
    selectionBackground: rgba(colors.selection, 0.7),
    // The active search match is a selection while the find input has focus.
    selectionInactiveBackground: rgba(colors.selection, 0.6),
    ...colors.ansi,
  };
}
