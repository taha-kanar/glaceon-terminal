import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES, DEFAULT_THEME_ID, resolveTheme } from './builtin-themes';
import {
  ANSI_COLOR_NAMES,
  deriveUiPalette,
  isHexColor,
  luminance,
  mix,
  parseHex,
  rgba,
  toHex,
} from './theme';

describe('built-in themes', () => {
  it('ships seven themes with unique ids and complete, valid palettes', () => {
    expect(BUILTIN_THEMES).toHaveLength(7);
    expect(new Set(BUILTIN_THEMES.map((t) => t.id)).size).toBe(7);
    for (const theme of BUILTIN_THEMES) {
      const { ansi, ...rest } = theme.colors;
      for (const color of Object.values(rest)) expect(isHexColor(color)).toBe(true);
      expect(Object.keys(ansi)).toEqual([...ANSI_COLOR_NAMES]);
      for (const color of Object.values(ansi)) expect(isHexColor(color)).toBe(true);
    }
  });

  it('resolves unknown ids to the default theme', () => {
    expect(resolveTheme('dracula').name).toBe('Dracula');
    expect(resolveTheme('nope').id).toBe(DEFAULT_THEME_ID);
  });
});

describe('color helpers', () => {
  it('parses and formats hex colors', () => {
    expect(parseHex('#7aa2f7')).toEqual({ r: 122, g: 162, b: 247 });
    expect(parseHex('7aa2f7')).toBeUndefined();
    expect(toHex({ r: 300, g: -4, b: 15.6 })).toBe('#ff0010');
    expect(rgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(rgba('bad', 2)).toBe('rgba(0, 0, 0, 1)');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('#000000')).toBe(0);
  });

  it('derives chrome colors from the theme', () => {
    const palette = deriveUiPalette(resolveTheme('nord'), 0.5);
    expect(palette.surface).toBe('rgba(46, 52, 64, 0.5)');
    expect(palette.accent).toBe('#88c0d0');
    expect(palette.danger).toBe('#bf616a');
  });
});
