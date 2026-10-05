import { isNonEmptyString, isRecord } from './guards';
import type { RunCommandRequest } from './bridge';

export function decodeRunCommandRequest(value: unknown): RunCommandRequest | undefined {
  if (!isRecord(value) || !isNonEmptyString(value['command'])) return undefined;
  const args = value['args'];
  if (args !== undefined && typeof args !== 'string' && typeof args !== 'number') return undefined;
  return args === undefined ? { command: value['command'] } : { command: value['command'], args };
}
