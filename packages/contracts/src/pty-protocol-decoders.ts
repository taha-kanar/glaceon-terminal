import { isFiniteNumber, isNonEmptyString, isOptional, isRecord } from './guards';
import type { PtyClientMessage, PtyHostControlMessage, PtyHostMessage } from './pty-protocol';

/**
 * Hand-written decoders for the hot path (every keystroke and output chunk), where a
 * schema library would add measurable overhead. Unknown or malformed messages yield
 * `undefined` and are dropped by the receiver.
 */
export function decodePtyClientMessage(value: unknown): PtyClientMessage | undefined {
  if (!isRecord(value) || !isNonEmptyString(value['sid'])) return undefined;
  const message = value as PtyClientMessage;
  switch (message.t) {
    case 'spawn':
      return isFiniteNumber(message.reqId) &&
        isFiniteNumber(message.cols) &&
        isFiniteNumber(message.rows) &&
        isOptional(message.cwd, isNonEmptyString)
        ? message
        : undefined;
    case 'input':
      return typeof message.data === 'string' ? message : undefined;
    case 'resize':
      return isFiniteNumber(message.cols) && isFiniteNumber(message.rows) ? message : undefined;
    case 'kill':
      return message;
    default:
      return undefined;
  }
}

export function decodePtyHostMessage(value: unknown): PtyHostMessage | undefined {
  if (!isRecord(value)) return undefined;
  const message = value as PtyHostMessage;
  switch (message.t) {
    case 'spawned':
      return isFiniteNumber(message.reqId) && isFiniteNumber(message.pid) ? message : undefined;
    case 'spawnFailed':
      return isFiniteNumber(message.reqId) && typeof message.message === 'string'
        ? message
        : undefined;
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
    default:
      return undefined;
  }
}

export function decodePtyHostControlMessage(value: unknown): PtyHostControlMessage | undefined {
  if (!isRecord(value) || !isNonEmptyString(value['connectionId'])) return undefined;
  const kind = value['t'];
  return kind === 'connect' || kind === 'disconnect' ? (value as PtyHostControlMessage) : undefined;
}
