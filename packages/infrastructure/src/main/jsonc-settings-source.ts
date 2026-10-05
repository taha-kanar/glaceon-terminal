import { createHash } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { SettingsSource } from '@glaceon/application';
import {
  err,
  ok,
  toDisposable,
  type Disposable,
  type PartialSettings,
  type Result,
} from '@glaceon/domain';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { describeIssues, settingsSchema, toPartialSettings } from './settings-schema';
import { SETTINGS_TEMPLATE } from './settings-template';

function lineOf(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

/** Parses JSONC settings text into validated partial settings. */
export function parseSettingsText(text: string): Result<PartialSettings, string> {
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
export class JsoncSettingsSource implements SettingsSource {
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
    this.#lastHash = createHash('sha1').update(text).digest('hex');
    return parseSettingsText(text);
  }

  watch(onChange: () => void): Disposable {
    let timer: NodeJS.Timeout | undefined;
    let watcher: FSWatcher | undefined;
    const fire = (): void => {
      void readFile(this.#path, 'utf8')
        .then((text) => createHash('sha1').update(text).digest('hex'))
        .catch(() => undefined)
        .then((hash) => {
          if (hash === undefined || hash !== this.#lastHash) onChange();
        });
    };
    try {
      watcher = watch(dirname(this.#path), (_event, filename) => {
        if (filename !== null && filename !== basename(this.#path)) return;
        clearTimeout(timer);
        timer = setTimeout(fire, this.#debounceMs);
      });
    } catch {
      watcher = undefined;
    }
    return toDisposable(() => {
      clearTimeout(timer);
      watcher?.close();
    });
  }
}
