import { describe, expect, it } from 'vitest';
import { decodeRunCommandRequest } from './run-command-decoder';

describe('decodeRunCommandRequest', () => {
  it('accepts commands with optional scalar args', () => {
    expect(decodeRunCommandRequest({ command: 'tab.new' })).toEqual({ command: 'tab.new' });
    expect(decodeRunCommandRequest({ command: 'tab.select', args: 2 })).toEqual({
      command: 'tab.select',
      args: 2,
    });
  });

  it('rejects anything else', () => {
    for (const bad of [null, {}, { command: '' }, { command: 'x', args: {} }]) {
      expect(decodeRunCommandRequest(bad)).toBeUndefined();
    }
  });
});
