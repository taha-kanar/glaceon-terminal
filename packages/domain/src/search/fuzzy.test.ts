import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyMatch } from './fuzzy';

describe('fuzzyMatch', () => {
  it('matches subsequences case-insensitively and reports indices', () => {
    expect(fuzzyMatch('spr', 'Split Pane Right')?.indices).toEqual([0, 1, 11]);
    expect(fuzzyMatch('xyz', 'Split Right')).toBeUndefined();
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] });
  });

  it('ranks word starts and consecutive runs higher', () => {
    const results = fuzzyFilter(
      ['Close Tab', 'Theme: Catppuccin Mocha', 'New Tab', 'Toggle Pane Zoom'],
      'tab',
      (s) => s,
    ).map((r) => r.item);
    expect([...results.slice(0, 2)].sort()).toEqual(['Close Tab', 'New Tab']);
    const split = fuzzyFilter(['Equalize Panes', 'Split Down'], 'sd', (s) => s).map((r) => r.item);
    expect(split[0]).toBe('Split Down');
  });

  it('treats camelCase humps as word starts', () => {
    expect(fuzzyMatch('pr', 'paneResize')?.indices).toEqual([0, 4]);
  });
});
