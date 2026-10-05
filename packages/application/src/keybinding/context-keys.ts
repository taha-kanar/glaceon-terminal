import { ObservableStore, type ReadableStore } from '../store/store';

export type ContextKeyValues = Readonly<Record<string, boolean>>;

/** Boolean flags (`terminalFocus`, `searchOpen` …) that keybinding `when` clauses test. */
export class ContextKeys implements ReadableStore<ContextKeyValues> {
  readonly #store = new ObservableStore<ContextKeyValues>({});

  get(): ContextKeyValues {
    return this.#store.get();
  }

  subscribe(listener: () => void): ReturnType<ReadableStore<ContextKeyValues>['subscribe']> {
    return this.#store.subscribe(listener);
  }

  is(key: string): boolean {
    return this.#store.get()[key] ?? false;
  }

  set(key: string, value: boolean): void {
    if (this.is(key) === value) return;
    this.#store.update((values) => ({ ...values, [key]: value }));
  }
}
