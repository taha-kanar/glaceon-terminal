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
    { t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24, shell: '/bin/bash' },
    { t: 'input', sid: 'a', data: '' },
    { t: 'resize', sid: 'a', cols: 1, rows: 1 },
    { t: 'kill', sid: 'a' },
    { t: 'ack', sid: 'a', bytes: 5000 },
    { t: 'cwd', reqId: 3, sid: 'a' },
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
    { t: 'ack', sid: 'a', bytes: -1 },
    { t: 'cwd', sid: 'a' },
  ])('rejects %o', (message) => {
    expect(decodePtyClientMessage(message)).toBeUndefined();
  });
});

describe('decodePtyHostMessage', () => {
  it('accepts well-formed messages', () => {
    const chunk = new Uint8Array([104, 105]);
    for (const message of [
      { t: 'spawned', reqId: 1, pid: 99, shell: 'zsh' },
      { t: 'process', sid: 'a', name: 'vim', busy: true },
      { t: 'cwd', reqId: 2 },
      { t: 'cwd', reqId: 2, cwd: '/tmp' },
      { t: 'spawnFailed', reqId: 1, message: 'nope' },
      { t: 'data', sid: 'a', chunk },
      { t: 'exit', sid: 'a', exitCode: 0 },
      { t: 'exit', sid: 'a', exitCode: 0, signal: 9 },
    ]) {
      expect(decodePtyHostMessage(message)).toBe(message);
    }
  });

  it('rejects malformed messages', () => {
    expect(decodePtyHostMessage({ t: 'data', sid: 'a', chunk: 'hi' })).toBeUndefined();
    expect(decodePtyHostMessage({ t: 'spawned', reqId: 1, pid: 2 })).toBeUndefined();
    expect(decodePtyHostMessage({ t: 'cwd', reqId: 1, cwd: '' })).toBeUndefined();
    expect(decodePtyHostMessage({ t: 'process', sid: 'a' })).toBeUndefined();
    expect(decodePtyHostMessage({ t: 'nope' })).toBeUndefined();
    expect(decodePtyHostMessage(7)).toBeUndefined();
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

describe('process monitoring messages', () => {
  it('decodes monitor and signal requests without a session id', () => {
    expect(decodePtyClientMessage({ t: 'monitor', on: true })).toEqual({ t: 'monitor', on: true });
    expect(decodePtyClientMessage({ t: 'monitor', on: 'yes' })).toBeUndefined();
    expect(decodePtyClientMessage({ t: 'signal', pid: 12, signal: 'SIGINT' })).toBeDefined();
    expect(decodePtyClientMessage({ t: 'signal', pid: 12, signal: 'SIGHUP' })).toBeUndefined();
    expect(decodePtyClientMessage({ t: 'signal', pid: '12', signal: 'SIGINT' })).toBeUndefined();
  });

  it('decodes process reports', () => {
    const report = { t: 'processes', sessions: [{ sid: 'a', pid: 1, processes: [] }] };
    expect(decodePtyHostMessage(report)).toEqual(report);
    expect(decodePtyHostMessage({ t: 'processes', sessions: [{ sid: 'a' }] })).toBeUndefined();
    expect(decodePtyHostMessage({ t: 'processes', sessions: 'x' })).toBeUndefined();
  });
});

describe('session transfer messages', () => {
  it('decodes detach and attach', () => {
    expect(decodePtyClientMessage({ t: 'detach', sid: 'a' })).toEqual({ t: 'detach', sid: 'a' });
    expect(decodePtyClientMessage({ t: 'attach', sid: 'a', reqId: 1 })).toBeDefined();
    expect(decodePtyClientMessage({ t: 'attach', sid: 'a' })).toBeUndefined();
    expect(decodePtyHostMessage({ t: 'detached', sid: 'a' })).toBeDefined();
    expect(decodePtyHostMessage({ t: 'detached' })).toBeUndefined();
    expect(decodePtyHostMessage({ t: 'attached', reqId: 1, pid: 5 })).toBeDefined();
    expect(decodePtyHostMessage({ t: 'attached', reqId: 1, message: 'gone' })).toBeDefined();
    expect(decodePtyHostMessage({ t: 'attached', reqId: 1, pid: 'x' })).toBeUndefined();
  });
});
