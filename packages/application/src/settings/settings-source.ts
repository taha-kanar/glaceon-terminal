import type { Disposable, PartialSettings, Result, Settings } from '@glaceon/domain';

/** Where settings are persisted (a JSONC file on disk in production). */
export interface SettingsSource {
  /** Reads and validates the settings. A missing file yields an empty object. */
  read(): Promise<Result<PartialSettings, string>>;
  /** Calls `onChange` (debounced) whenever the stored settings may have changed. */
  watch(onChange: () => void): Disposable;
}

/** A settings source that can also persist a single changed value. */
export interface WritableSettingsSource extends SettingsSource {
  write<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Result<void, string>>;
}
