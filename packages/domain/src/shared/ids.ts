import type { Brand } from './brand';

export type SessionId = Brand<string, 'SessionId'>;

export function asSessionId(value: string): SessionId {
  if (value.length === 0) {
    throw new RangeError('SessionId must not be empty');
  }
  return value as SessionId;
}
