import { describe, expect, it } from 'vitest';
import {
  decodeLinkOpenRequest,
  decodeRunCommandRequest,
  decodeSettingsUpdateRequest,
} from './request-decoders';

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

describe('decodeLinkOpenRequest', () => {
  it('accepts urls and files with optional positions', () => {
    expect(decodeLinkOpenRequest({ kind: 'url', url: 'https://x' })).toEqual({
      kind: 'url',
      url: 'https://x',
    });
    expect(
      decodeLinkOpenRequest({ kind: 'file', path: 'a.ts', cwd: '/w', line: 2, column: 1 }),
    ).toEqual({
      kind: 'file',
      path: 'a.ts',
      cwd: '/w',
      line: 2,
      column: 1,
    });
  });

  it('rejects malformed requests', () => {
    for (const bad of [
      null,
      { kind: 'url' },
      { kind: 'file', path: '' },
      { kind: 'file', path: 'a', line: 0 },
      { kind: 'exec', path: 'a' },
    ]) {
      expect(decodeLinkOpenRequest(bad)).toBeUndefined();
    }
  });
});
