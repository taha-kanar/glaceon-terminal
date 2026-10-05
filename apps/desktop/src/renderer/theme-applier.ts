import { deriveUiPalette, TAB_COLORS, tabColorValue, type Theme } from '@glaceon/domain';

const VARIABLES = {
  surface: '--surface',
  surfaceRaised: '--surface-raised',
  text: '--text',
  textMuted: '--text-muted',
  accent: '--accent',
  accentSoft: '--accent-soft',
  border: '--border',
  danger: '--danger',
  warning: '--warning',
  success: '--success',
} as const;

/** Publishes the theme's chrome colors as CSS custom properties. */
export function applyTheme(root: HTMLElement, theme: Theme, backgroundOpacity: number): void {
  const palette = deriveUiPalette(theme, backgroundOpacity);
  for (const [key, variable] of Object.entries(VARIABLES)) {
    root.style.setProperty(variable, palette[key as keyof typeof VARIABLES]);
  }
  for (const color of TAB_COLORS) {
    root.style.setProperty(`--tab-${color}`, tabColorValue(theme.colors, color));
  }
}
