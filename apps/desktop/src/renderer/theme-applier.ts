import { backgroundImageUrl } from '@glaceon/contracts';
import {
  deriveUiPalette,
  TAB_COLORS,
  tabColorValue,
  type Settings,
  type Theme,
} from '@glaceon/domain';

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

/** The color and image painted behind the terminal (the image is served by main). */
export function applyBackground(root: HTMLElement, settings: Settings): void {
  const { backgroundColor, backgroundImage, backgroundImageFit } = settings;
  root.style.setProperty(
    '--background-color',
    backgroundColor === '' ? 'transparent' : backgroundColor,
  );
  root.style.setProperty(
    '--background-image',
    backgroundImage.trim() === '' ? 'none' : `url("${backgroundImageUrl(backgroundImage)}")`,
  );
  root.style.setProperty(
    '--background-image-size',
    backgroundImageFit === 'fill' ? '100% 100%' : backgroundImageFit,
  );
  root.style.setProperty('--background-image-opacity', String(settings.backgroundImageOpacity));
}
