import { withDefaults, type Disposable } from '@glaceon/domain';
import { ObservableStore, type ReadableStore } from '../store/store';
import type { SettingsSource } from './settings-source';
import { INITIAL_SETTINGS_STATE, type SettingsState } from './settings-state';

/**
 * Loads settings and reloads them on change. An invalid file never replaces working settings:
 * the last good settings stay in effect and the problem is reported alongside them.
 */
export class SettingsService {
  readonly #source: SettingsSource;
  readonly #state = new ObservableStore<SettingsState>(INITIAL_SETTINGS_STATE);
  #watch: Disposable | undefined;
  #generation = 0;

  constructor(source: SettingsSource) {
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

  dispose(): void {
    this.#watch?.dispose();
    this.#watch = undefined;
  }
}
