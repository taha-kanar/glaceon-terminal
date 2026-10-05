export const ANSI_COLOR_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const;

export type AnsiColorName = (typeof ANSI_COLOR_NAMES)[number];

/** `#rrggbb`. */
export type HexColor = string;

export interface ThemeColors {
  readonly background: HexColor;
  readonly foreground: HexColor;
  readonly cursor: HexColor;
  readonly cursorAccent: HexColor;
  readonly selection: HexColor;
  /** UI accent: active tab, focus ring, dividers being dragged. */
  readonly accent: HexColor;
  readonly ansi: Readonly<Record<AnsiColorName, HexColor>>;
}

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly colors: ThemeColors;
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

export function parseHex(value: HexColor): Rgb | undefined {
  const digits = HEX_PATTERN.exec(value)?.[1];
  if (digits === undefined) return undefined;
  const number = Number.parseInt(digits, 16);
  return { r: (number >> 16) & 0xff, g: (number >> 8) & 0xff, b: number & 0xff };
}

export function toHex({ r, g, b }: Rgb): HexColor {
  const channel = (value: number): string =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** `rgba(...)` CSS for a hex color at the given opacity (0..1). Invalid input becomes black. */
export function rgba(color: HexColor, alpha: number): string {
  const { r, g, b } = parseHex(color) ?? { r: 0, g: 0, b: 0 };
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(Math.round(a * 1000) / 1000)})`;
}

/** Linear mix: `amount` 0 returns `from`, 1 returns `to`. */
export function mix(from: HexColor, to: HexColor, amount: number): HexColor {
  const a = parseHex(from) ?? { r: 0, g: 0, b: 0 };
  const b = parseHex(to) ?? { r: 0, g: 0, b: 0 };
  const t = Math.min(1, Math.max(0, amount));
  return toHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
}

/** WCAG relative luminance in [0, 1]. */
export function luminance(color: HexColor): number {
  const { r, g, b } = parseHex(color) ?? { r: 0, g: 0, b: 0 };
  const linear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Colors the chrome (tab bar, overlays, banners) derives from a theme. */
export interface UiPalette {
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly text: HexColor;
  readonly textMuted: string;
  readonly accent: HexColor;
  readonly accentSoft: string;
  readonly border: string;
  readonly danger: HexColor;
  readonly warning: HexColor;
  readonly success: HexColor;
}

export function deriveUiPalette(theme: Theme, backgroundOpacity: number): UiPalette {
  const { colors } = theme;
  return {
    surface: rgba(colors.background, backgroundOpacity),
    surfaceRaised: rgba(mix(colors.background, colors.foreground, 0.08), 0.96),
    text: colors.foreground,
    textMuted: rgba(colors.foreground, 0.55),
    accent: colors.accent,
    accentSoft: rgba(colors.accent, 0.18),
    border: rgba(colors.foreground, 0.1),
    danger: colors.ansi.red,
    warning: colors.ansi.yellow,
    success: colors.ansi.green,
  };
}
