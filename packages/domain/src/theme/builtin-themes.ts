import { ANSI_COLOR_NAMES, type AnsiColorName, type HexColor, type Theme } from './theme';

type Palette = readonly [
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
];

function ansi(palette: Palette): Record<AnsiColorName, HexColor> {
  return Object.fromEntries(ANSI_COLOR_NAMES.map((name, i) => [name, palette[i]])) as Record<
    AnsiColorName,
    HexColor
  >;
}

interface ThemeSpec {
  readonly id: string;
  readonly name: string;
  readonly background: HexColor;
  readonly foreground: HexColor;
  readonly accent: HexColor;
  readonly selection: HexColor;
  readonly palette: Palette;
}

function theme(spec: ThemeSpec): Theme {
  return {
    id: spec.id,
    name: spec.name,
    colors: {
      background: spec.background,
      foreground: spec.foreground,
      cursor: spec.accent,
      cursorAccent: spec.background,
      selection: spec.selection,
      accent: spec.accent,
      ansi: ansi(spec.palette),
    },
  };
}

// prettier-ignore
export const BUILTIN_THEMES: readonly Theme[] = [
  theme({
    id: 'tokyo-night', name: 'Tokyo Night',
    background: '#1a1b26', foreground: '#c0caf5', accent: '#7aa2f7', selection: '#33467c',
    palette: ['#15161e', '#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff', '#a9b1d6',
              '#414868', '#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff', '#c0caf5'],
  }),
  theme({
    id: 'catppuccin-mocha', name: 'Catppuccin Mocha',
    background: '#1e1e2e', foreground: '#cdd6f4', accent: '#89b4fa', selection: '#585b70',
    palette: ['#45475a', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#cba6f7', '#94e2d5', '#bac2de',
              '#585b70', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#cba6f7', '#94e2d5', '#a6adc8'],
  }),
  theme({
    id: 'dracula', name: 'Dracula',
    background: '#282a36', foreground: '#f8f8f2', accent: '#bd93f9', selection: '#44475a',
    palette: ['#21222c', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd', '#f8f8f2',
              '#6272a4', '#ff6e6e', '#69ff94', '#ffffa5', '#d6acff', '#ff92df', '#a4ffff', '#ffffff'],
  }),
  theme({
    id: 'nord', name: 'Nord',
    background: '#2e3440', foreground: '#d8dee9', accent: '#88c0d0', selection: '#434c5e',
    palette: ['#3b4252', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#88c0d0', '#e5e9f0',
              '#4c566a', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#8fbcbb', '#eceff4'],
  }),
  theme({
    id: 'gruvbox-dark', name: 'Gruvbox Dark',
    background: '#282828', foreground: '#ebdbb2', accent: '#d79921', selection: '#504945',
    palette: ['#282828', '#cc241d', '#98971a', '#d79921', '#458588', '#b16286', '#689d6a', '#a89984',
              '#928374', '#fb4934', '#b8bb26', '#fabd2f', '#83a598', '#d3869b', '#8ec07c', '#ebdbb2'],
  }),
  theme({
    id: 'one-dark', name: 'One Dark',
    background: '#282c34', foreground: '#abb2bf', accent: '#61afef', selection: '#3e4451',
    palette: ['#282c34', '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#abb2bf',
              '#5c6370', '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#ffffff'],
  }),
  theme({
    id: 'solarized-dark', name: 'Solarized Dark',
    background: '#002b36', foreground: '#839496', accent: '#268bd2', selection: '#073642',
    palette: ['#073642', '#dc322f', '#859900', '#b58900', '#268bd2', '#d33682', '#2aa198', '#eee8d5',
              '#586e75', '#cb4b16', '#93a1a1', '#657b83', '#839496', '#6c71c4', '#93a1a1', '#fdf6e3'],
  }),
];

export const DEFAULT_THEME_ID = 'tokyo-night';

/** Looks a theme up among `themes`; unknown ids fall back to the default built-in theme. */
export function resolveTheme(id: string, themes: readonly Theme[] = BUILTIN_THEMES): Theme {
  const fallback = BUILTIN_THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0];
  const found = themes.find((t) => t.id === id) ?? fallback;
  if (found === undefined) throw new Error('No built-in themes');
  return found;
}
