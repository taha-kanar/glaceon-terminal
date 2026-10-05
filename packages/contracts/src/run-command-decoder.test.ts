import { describe, expect, it } from 'vitest';
import { decodeRunCommandRequest, decodeSettingsUpdateRequest } from './run-command-decoder';

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

describe('decodeSettingsUpdateRequest', () => {
  it('requires a key and a value', () => {
    expect(decodeSettingsUpdateRequest({ key: 'fontSize', value: 14 })).toEqual({
      key: 'fontSize',
      value: 14,
    });
    expect(decodeSettingsUpdateRequest({ key: 'fontSize' })).toBeUndefined();
    expect(decodeSettingsUpdateRequest({ key: '', value: 1 })).toBeUndefined();
  });
});
