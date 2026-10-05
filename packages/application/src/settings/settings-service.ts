import { withDefaults, type Disposable, type Result, type Settings } from '@glaceon/domain';
import { ObservableStore, type ReadableStore } from '../store/store';
import type { SettingsSource, WritableSettingsSource } from './settings-source';
import type { SettingsWriter } from './settings-writer';
import { INITIAL_SETTINGS_STATE, type SettingsState } from './settings-state';

/**
 * Loads settings and reloads them on change. An invalid file never replaces working settings:
 * the last good settings stay in effect and the problem is reported alongside them.
 */
export class SettingsService implements SettingsWriter {
  readonly #source: SettingsSource | WritableSettingsSource;
  readonly #state = new ObservableStore<SettingsState>(INITIAL_SETTINGS_STATE);
  #watch: Disposable | undefined;
  #generation = 0;

  constructor(source: SettingsSource | WritableSettingsSource) {
    this.#source = source;
  }

  get state(): ReadableStore<SettingsState> {
    return this.#state;
  }

  async start(): Promise<void> {
    await this.reload();
    this.#watch ??= this.#source.watch(() => void this.reload());
  }

  async reload(): Promise<void> {
    const generation = ++this.#generation;
    const result = await this.#source.read();
    // A slower, older read must not overwrite a newer one.
    if (generation !== this.#generation) return;
    this.#state.set(
      result.ok
        ? { settings: withDefaults(result.value), problems: [] }
        : { settings: this.#state.get().settings, problems: [result.error] },
    );
  }

  /** Writes one value and reloads, so the new state is in effect when this resolves. */
  async update<K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ): Promise<Result<void, string>> {
    if (!('write' in this.#source)) throw new Error('Settings source is read-only');
    const written = await this.#source.write(key, value);
    if (written.ok) await this.reload();
    return written;
  }

  dispose(): void {
    this.#watch?.dispose();
    this.#watch = undefined;
  }
}
