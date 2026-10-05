import type { Disposable, PartialSettings, Result } from '@glaceon/domain';

/** Where settings are persisted (a JSONC file on disk in production). */
export interface SettingsSource {
  /** Reads and validates the settings. A missing file yields an empty object. */
  read(): Promise<Result<PartialSettings, string>>;
  /** Calls `onChange` (debounced) whenever the stored settings may have changed. */
  watch(onChange: () => void): Disposable;
}
