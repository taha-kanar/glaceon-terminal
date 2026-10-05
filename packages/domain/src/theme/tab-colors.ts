import type { TabColor } from '../workspace/workspace';
import { mix, type HexColor, type ThemeColors } from './theme';

/** Tab and group colors come from the theme's ANSI palette so they fit every theme. */
export function tabColorValue(colors: ThemeColors, color: TabColor): HexColor {
  const { ansi } = colors;
  switch (color) {
    case 'red':
      return ansi.red;
    case 'orange':
      return mix(ansi.red, ansi.yellow, 0.5);
    case 'yellow':
      return ansi.yellow;
    case 'green':
      return ansi.green;
    case 'cyan':
      return ansi.cyan;
    case 'blue':
      return ansi.blue;
    case 'purple':
      return ansi.magenta;
  }
}
