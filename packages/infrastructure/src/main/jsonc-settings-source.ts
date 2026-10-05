import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { WritableSettingsSource } from '@glaceon/application';
import {
  err,
  ok,
  type Disposable,
  type PartialSettings,
  type Result,
  type Settings,
} from '@glaceon/domain';
import {
  applyEdits,
  modify,
  parse,
  printParseErrorCode,
  stripComments,
  type ParseError,
} from 'jsonc-parser';
import {
  describeIssues,
  settingsSchema,
  toPartialSettings,
  validateSetting,
} from './settings-schema';
import { contentHash, watchFileContent } from './file-watch';
import { SETTINGS_TEMPLATE } from './settings-template';

function lineOf(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

/** Parses JSONC settings text into validated partial settings. */
export function parseSettingsText(text: string): Result<PartialSettings, string> {
  if (stripComments(text).trim() === '') return ok({});
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, { allowTrailingComma: true });
  const first = errors[0];
  if (first !== undefined) {
    return err(`${printParseErrorCode(first.error)} at line ${String(lineOf(text, first.offset))}`);
  }
  if (value === undefined) return ok({});
  const parsed = settingsSchema.safeParse(value);
  return parsed.success ? ok(toPartialSettings(parsed.data)) : err(describeIssues(parsed.error));
}

export interface JsoncSettingsSourceOptions {
  readonly path: string;
  readonly debounceMs?: number;
}

/**
 * Settings in a JSONC file. The directory (not the file) is watched, since editors replace
 * files on save; events are debounced and ignored when the content did not change.
 */
export class JsoncSettingsSource implements WritableSettingsSource {
  readonly #path: string;
  readonly #debounceMs: number;
  #lastHash: string | undefined;

  constructor(options: JsoncSettingsSourceOptions) {
    this.#path = options.path;
    this.#debounceMs = options.debounceMs ?? 100;
  }

  get path(): string {
    return this.#path;
  }

  /** Creates the file with a commented template when it does not exist yet. */
  async ensureExists(): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true });
    try {
      await writeFile(this.#path, SETTINGS_TEMPLATE, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  async read(): Promise<Result<PartialSettings, string>> {
    let text: string;
    try {
      text = await readFile(this.#path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ok({});
      return err(`Cannot read ${this.#path}: ${(error as Error).message}`);
    }
    this.#lastHash = contentHash(text);
    return parseSettingsText(text);
  }

  /**
   * Changes one top-level value in place, keeping comments and formatting, and replaces the
   * file atomically (write a sibling, then rename) so readers never see half a file.
   */
  async write<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Result<void, string>> {
    const invalid = validateSetting(key, value);
    if (invalid !== undefined) return err(invalid);
    let text: string;
    try {
      text = await readFile(this.#path, 'utf8');
    } catch {
      text = SETTINGS_TEMPLATE;
    }
    const errors: ParseError[] = [];
    parse(text, errors, { allowTrailingComma: true });
    if (errors.length > 0)
      return err('Fix the syntax errors in config.json before changing settings here');
    const edits = modify(text, [key], value, {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
    });
    const next = applyEdits(text, edits);
    try {
      await mkdir(dirname(this.#path), { recursive: true });
      const temporary = `${this.#path}.${String(process.pid)}.tmp`;
      await writeFile(temporary, next);
      await rename(temporary, this.#path);
    } catch (error) {
      return err(`Cannot write ${this.#path}: ${(error as Error).message}`);
    }
    return ok(undefined);
  }

  watch(onChange: () => void): Disposable {
    return watchFileContent(this.#path, {
      debounceMs: this.#debounceMs,
      lastHash: () => this.#lastHash,
      onChange,
    });
  }
}
