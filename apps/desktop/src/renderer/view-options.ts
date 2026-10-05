import { mix, type Settings, type Theme } from '@glaceon/domain';
import { toXtermTheme, type XtermViewOptions } from '@glaceon/infrastructure/renderer';

export function viewOptions(settings: Settings, theme: Theme): XtermViewOptions {
  return {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    letterSpacing: settings.letterSpacing,
    theme: toXtermTheme(theme),
    cursorStyle: settings.cursorStyle,
    cursorBlink: settings.cursorBlink,
    scrollback: settings.scrollback,
    macOptionIsMeta: settings.macOptionIsMeta,
    searchColors: {
      // Other matches are muted so the active one stands out.
      match: mix(theme.colors.background, theme.colors.ansi.yellow, 0.45),
      active: theme.colors.ansi.yellow,
    },
  };
}
