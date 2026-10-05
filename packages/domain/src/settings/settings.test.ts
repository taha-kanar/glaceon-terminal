import { describe, expect, it } from 'vitest';
import { clampFontSize, DEFAULT_SETTINGS, withDefaults } from './settings';

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
