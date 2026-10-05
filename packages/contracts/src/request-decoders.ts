import { isFiniteNumber, isNonEmptyString, isOptional, isRecord } from './guards';
import type {
  LinkOpenRequest,
  RunCommandRequest,
  SettingsUpdateRequest,
  TabImportResult,
} from './bridge';

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

const isPositive = (value: unknown): value is number => isFiniteNumber(value) && value > 0;

export function decodeLinkOpenRequest(value: unknown): LinkOpenRequest | undefined {
  if (!isRecord(value)) return undefined;
  if (value['kind'] === 'url') {
    return isNonEmptyString(value['url']) ? { kind: 'url', url: value['url'] } : undefined;
  }
  const { path, cwd, line, column } = value;
  if (
    value['kind'] !== 'file' ||
    !isNonEmptyString(path) ||
    !isOptional(cwd, isNonEmptyString) ||
    !isOptional(line, isPositive) ||
    !isOptional(column, isPositive)
  ) {
    return undefined;
  }
  return {
    kind: 'file',
    path,
    ...(cwd === undefined ? {} : { cwd }),
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
  };
}

export function decodeTabImportResult(value: unknown): TabImportResult | undefined {
  if (!isRecord(value) || !isFiniteNumber(value['transferId'])) return undefined;
  return typeof value['ok'] === 'boolean'
    ? { transferId: value['transferId'], ok: value['ok'] }
    : undefined;
}
