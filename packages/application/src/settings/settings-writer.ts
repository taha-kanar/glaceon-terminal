import type { Result, Settings } from '@glaceon/domain';

/** Persists a single setting (the file keeps its comments and other values). */
export interface SettingsWriter {
  update<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Result<void, string>>;
}
