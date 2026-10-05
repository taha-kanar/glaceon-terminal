import { isNonEmptyString, isRecord } from './guards';
import type { RunCommandRequest, SettingsUpdateRequest } from './bridge';

export function decodeRunCommandRequest(value: unknown): RunCommandRequest | undefined {
  if (!isRecord(value) || !isNonEmptyString(value['command'])) return undefined;
  const args = value['args'];
  if (args !== undefined && typeof args !== 'string' && typeof args !== 'number') return undefined;
  return args === undefined ? { command: value['command'] } : { command: value['command'], args };
}

/** Shape check only; main validates the value against the settings schema before writing. */
export function decodeSettingsUpdateRequest(value: unknown): SettingsUpdateRequest | undefined {
  if (!isRecord(value) || !isNonEmptyString(value['key']) || !('value' in value)) return undefined;
  return { key: value['key'], value: value['value'] };
}
