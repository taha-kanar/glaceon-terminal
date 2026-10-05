import { describe, expect, it } from 'vitest';
import { rebindKeybinding, resetKeybinding, unbindKeybinding } from './keybinding-edits';

describe('keybinding edits', () => {
  const existing = [
    { key: 'cmd+e', command: 'pane.splitRight' },
    { key: '', command: '-pane.splitRight' },
    { key: 'cmd+y', command: 'tab.new' },
  ];

  it('rebinding replaces earlier overrides and removes defaults', () => {
    expect(rebindKeybinding(existing, { command: 'pane.splitRight', key: 'cmd+r' })).toEqual([
      { key: 'cmd+y', command: 'tab.new' },
      { key: '', command: '-pane.splitRight' },
      { key: 'cmd+r', command: 'pane.splitRight' },
    ]);
  });

  it('resets and unbinds', () => {
    expect(resetKeybinding(existing, 'pane.splitRight')).toEqual([
      { key: 'cmd+y', command: 'tab.new' },
    ]);
    expect(unbindKeybinding(existing, 'tab.new')).toEqual([
      ...existing.slice(0, 2),
      { key: '', command: '-tab.new' },
    ]);
  });
});
