import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES } from '../theme/builtin-themes';
import { cloneTheme, themeIdFor } from '../theme/theme';
import {
  activeTheme,
  availableThemes,
  clampFontSize,
  DEFAULT_SETTINGS,
  withDefaults,
} from './settings';

describe('settings', () => {
  it('fills missing fields from the defaults', () => {
    const settings = withDefaults({ fontSize: 15 });
    expect(settings.fontSize).toBe(15);
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('clamps font sizes', () => {
    expect(clampFontSize(2)).toBe(6);
    expect(clampFontSize(13.4)).toBe(13);
    expect(clampFontSize(200)).toBe(72);
  });
});

describe('custom themes', () => {
  const base = BUILTIN_THEMES[0]!;
  const mine = cloneTheme(base, { id: 'mine', name: 'Mine' });

  it('lists custom themes after built-ins and resolves the active one', () => {
    const settings = { ...DEFAULT_SETTINGS, customThemes: [mine], theme: 'mine' };
    expect(availableThemes(settings).at(-1)).toBe(mine);
    expect(availableThemes(settings)).toHaveLength(8);
    expect(activeTheme(settings)).toBe(mine);
    expect(activeTheme({ ...settings, theme: 'gone' }).id).toBe('tokyo-night');
  });

  it('lets a custom theme shadow a built-in id', () => {
    const shadow = cloneTheme(base, { id: base.id, name: 'Patched' });
    expect(availableThemes({ customThemes: [shadow] }).filter((t) => t.id === base.id)).toEqual([
      shadow,
    ]);
  });

  it('clones deeply and derives unique ids', () => {
    expect(mine.colors.ansi).not.toBe(base.colors.ansi);
    expect(themeIdFor('Gece Mavisi!', new Set())).toBe('gece-mavisi');
    expect(themeIdFor('Şık', new Set(['sik']))).toBe('sik-2');
    expect(themeIdFor('***', new Set())).toBe('custom-theme');
  });
});
