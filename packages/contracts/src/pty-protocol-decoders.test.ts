import { describe, expect, it } from 'vitest';
import {
  decodePtyClientMessage,
  decodePtyHostControlMessage,
  decodePtyHostMessage,
} from './pty-protocol-decoders';

describe('decodePtyClientMessage', () => {
  it.each([
    { t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24 },
    { t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24, cwd: '/tmp' },
    { t: 'input', sid: 'a', data: '' },
    { t: 'resize', sid: 'a', cols: 1, rows: 1 },
    { t: 'kill', sid: 'a' },
  ])('accepts %o', (message) => {
    expect(decodePtyClientMessage(message)).toEqual(message);
  });

  it.each([
    null,
    'spawn',
    { t: 'spawn', reqId: 1, sid: '', cols: 80, rows: 24 },
    { t: 'spawn', reqId: 1, sid: 'a', cols: Number.NaN, rows: 24 },
    { t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24, cwd: '' },
    { t: 'input', sid: 'a', data: 42 },
    { t: 'resize', sid: 'a', cols: '80', rows: 24 },
    { t: 'unknown', sid: 'a' },
  ])('rejects %o', (message) => {
    expect(decodePtyClientMessage(message)).toBeUndefined();
  });
});

describe('decodePtyHostMessage', () => {
  it('accepts well-formed messages', () => {
    const chunk = new Uint8Array([104, 105]);
    for (const message of [
      { t: 'spawned', reqId: 1, pid: 99 },
      { t: 'spawnFailed', reqId: 1, message: 'nope' },
      { t: 'data', sid: 'a', chunk },
      { t: 'exit', sid: 'a', exitCode: 0 },
      { t: 'exit', sid: 'a', exitCode: 0, signal: 9 },
    ]) {
      expect(decodePtyHostMessage(message)).toBe(message);
    }
  });

  it('rejects data that is not bytes', () => {
    expect(decodePtyHostMessage({ t: 'data', sid: 'a', chunk: 'hi' })).toBeUndefined();
  });
});

describe('decodePtyHostControlMessage', () => {
  it('accepts connect and disconnect, rejects anything else', () => {
    expect(decodePtyHostControlMessage({ t: 'connect', connectionId: 'w1' })).toBeDefined();
    expect(decodePtyHostControlMessage({ t: 'disconnect', connectionId: 'w1' })).toBeDefined();
    expect(decodePtyHostControlMessage({ t: 'connect' })).toBeUndefined();
    expect(decodePtyHostControlMessage({ t: 'reboot', connectionId: 'w1' })).toBeUndefined();
  });
});
