import { deriveUiPalette, resolveTheme, type Settings } from '@glaceon/domain';

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
export function applyTheme(root: HTMLElement, settings: Settings): void {
  const palette = deriveUiPalette(resolveTheme(settings.theme), settings.backgroundOpacity);
  for (const [key, variable] of Object.entries(VARIABLES)) {
    root.style.setProperty(variable, palette[key as keyof typeof VARIABLES]);
  }
}
