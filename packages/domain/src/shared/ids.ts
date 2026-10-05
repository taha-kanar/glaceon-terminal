import type { Brand } from './brand';

export type SessionId = Brand<string, 'SessionId'>;
export type PaneId = Brand<string, 'PaneId'>;
export type TabId = Brand<string, 'TabId'>;
export type TabGroupId = Brand<string, 'TabGroupId'>;

function nonEmpty(value: string, name: string): void {
  if (value.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }
}

export function asSessionId(value: string): SessionId {
  nonEmpty(value, 'SessionId');
  return value as SessionId;
}

export function asPaneId(value: string): PaneId {
  nonEmpty(value, 'PaneId');
  return value as PaneId;
}

export function asTabId(value: string): TabId {
  nonEmpty(value, 'TabId');
  return value as TabId;
}

export function asTabGroupId(value: string): TabGroupId {
  nonEmpty(value, 'TabGroupId');
  return value as TabGroupId;
}
