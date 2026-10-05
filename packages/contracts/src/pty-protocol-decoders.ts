import { PROCESS_SIGNALS } from '@glaceon/domain';
import { isFiniteNumber, isNonEmptyString, isOptional, isRecord } from './guards';
import type { PtyClientMessage, PtyHostControlMessage, PtyHostMessage } from './pty-protocol';

/**
 * Hand-written decoders for the hot path (every keystroke and output chunk), where a
 * schema library would add measurable overhead. Unknown or malformed messages yield
 * `undefined` and are dropped by the receiver.
 */
export function decodePtyClientMessage(value: unknown): PtyClientMessage | undefined {
  if (!isRecord(value)) return undefined;
  if (value['t'] === 'monitor') {
    return typeof value['on'] === 'boolean' ? (value as PtyClientMessage) : undefined;
  }
  if (value['t'] === 'signal') {
    const signal = value['signal'];
    return isFiniteNumber(value['pid']) && PROCESS_SIGNALS.some((s) => s === signal)
      ? (value as PtyClientMessage)
      : undefined;
  }
  if (!isNonEmptyString(value['sid'])) return undefined;
  const message = value as PtyClientMessage;
  switch (message.t) {
    case 'spawn':
      return isFiniteNumber(message.reqId) &&
        isFiniteNumber(message.cols) &&
        isFiniteNumber(message.rows) &&
        isOptional(message.cwd, isNonEmptyString) &&
        isOptional(message.shell, isNonEmptyString)
        ? message
        : undefined;
    case 'input':
      return typeof message.data === 'string' ? message : undefined;
    case 'resize':
      return isFiniteNumber(message.cols) && isFiniteNumber(message.rows) ? message : undefined;
    case 'ack':
      return isFiniteNumber(message.bytes) && message.bytes >= 0 ? message : undefined;
    case 'cwd':
    case 'attach':
      return isFiniteNumber(message.reqId) ? message : undefined;
    case 'detach':
    case 'kill':
      return message;
    case 'monitor':
    case 'signal':
    default:
      return undefined;
  }
}

type PtyHostReply = Extract<PtyHostMessage, { readonly t: 'spawned' | 'spawnFailed' | 'cwd' }>;

function decodeReply(message: PtyHostReply): PtyHostMessage | undefined {
  switch (message.t) {
    case 'spawned':
      return isFiniteNumber(message.reqId) &&
        isFiniteNumber(message.pid) &&
        typeof message.shell === 'string'
        ? message
        : undefined;
    case 'spawnFailed':
      return isFiniteNumber(message.reqId) && typeof message.message === 'string'
        ? message
        : undefined;
    case 'cwd':
      return isFiniteNumber(message.reqId) && isOptional(message.cwd, isNonEmptyString)
        ? message
        : undefined;
  }
}

export function decodePtyHostMessage(value: unknown): PtyHostMessage | undefined {
  if (!isRecord(value)) return undefined;
  const message = value as PtyHostMessage;
  switch (message.t) {
    case 'data':
      return isNonEmptyString(message.sid) && message.chunk instanceof Uint8Array
        ? message
        : undefined;
    case 'exit':
      return isNonEmptyString(message.sid) &&
        isFiniteNumber(message.exitCode) &&
        isOptional(message.signal, isFiniteNumber)
        ? message
        : undefined;
    case 'process':
      return isNonEmptyString(message.sid) &&
        typeof message.name === 'string' &&
        typeof message.busy === 'boolean'
        ? message
        : undefined;
    case 'detached':
      return isNonEmptyString(message.sid) ? message : undefined;
    case 'attached':
      return isFiniteNumber(message.reqId) &&
        isOptional(message.pid, isFiniteNumber) &&
        isOptional(message.message, (v): v is string => typeof v === 'string')
        ? message
        : undefined;
    case 'processes':
      return Array.isArray(message.sessions) &&
        message.sessions.every(
          (report) =>
            isRecord(report) &&
            isNonEmptyString(report['sid']) &&
            isFiniteNumber(report['pid']) &&
            Array.isArray(report['processes']),
        )
        ? message
        : undefined;
    case 'spawned':
    case 'spawnFailed':
    case 'cwd':
      return decodeReply(message);
    default:
      return undefined;
  }
}

export function decodePtyHostControlMessage(value: unknown): PtyHostControlMessage | undefined {
  if (!isRecord(value) || !isNonEmptyString(value['connectionId'])) return undefined;
  const kind = value['t'];
  return kind === 'connect' || kind === 'disconnect' ? (value as PtyHostControlMessage) : undefined;
}
