import { clampFontSize, type Settings } from '@glaceon/domain';
import { computed, ObservableStore, type ReadableStore } from '../store/store';

/** Per-window font size adjustment (⌘= / ⌘- / ⌘0) layered over the configured size. */
export class FontZoom {
  readonly #delta = new ObservableStore(0);
  readonly #base: ReadableStore<Settings>;
  readonly effective: ReadableStore<Settings>;

  constructor(base: ReadableStore<Settings>) {
    this.#base = base;
    this.effective = computed([base, this.#delta], () => {
      const settings = base.get();
      const fontSize = clampFontSize(settings.fontSize + this.#delta.get());
      return fontSize === settings.fontSize ? settings : { ...settings, fontSize };
    });
  }

  increase(): void {
    this.#step(1);
  }

  decrease(): void {
    this.#step(-1);
  }

  reset(): void {
    this.#delta.set(0);
  }

  #step(sign: number): void {
    const base = this.#base.get().fontSize;
    const next = clampFontSize(base + this.#delta.get() + sign);
    this.#delta.set(next - base);
  }
}
