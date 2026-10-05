import { DisposableStore, Emitter, type Disposable } from '@glaceon/domain';

/** Read side of a piece of state. React binds to it with `useSyncExternalStore`. */
export interface ReadableStore<T> {
  get(): T;
  /** Called after every change. The listener reads the new value with `get()`. */
  subscribe(listener: () => void): Disposable;
}

export type Equality<T> = (a: T, b: T) => boolean;

/** Holds a value and notifies subscribers when it changes. Only services write to it. */
export class ObservableStore<T> implements ReadableStore<T> {
  readonly #changed = new Emitter<undefined>();
  readonly #equals: Equality<T>;
  #value: T;

  constructor(initial: T, equals: Equality<T> = Object.is) {
    this.#value = initial;
    this.#equals = equals;
  }

  get(): T {
    return this.#value;
  }

  set(value: T): void {
    if (this.#equals(this.#value, value)) return;
    this.#value = value;
    this.#changed.emit(undefined);
  }

  update(change: (value: T) => T): void {
    this.set(change(this.#value));
  }

  subscribe(listener: () => void): Disposable {
    return this.#changed.on(listener);
  }
}

/**
 * A value computed from other stores. It is recomputed on `get()` only when a source value
 * changed (by identity), so an unchanged selection keeps its identity (important for React).
 */
export class ComputedStore<T> implements ReadableStore<T> {
  readonly #sources: readonly ReadableStore<unknown>[];
  readonly #compute: () => T;
  readonly #equals: Equality<T>;
  #inputs: readonly unknown[];
  #value: T;

  constructor(
    sources: readonly ReadableStore<unknown>[],
    compute: () => T,
    equals: Equality<T> = Object.is,
  ) {
    this.#sources = sources;
    this.#compute = compute;
    this.#equals = equals;
    this.#inputs = sources.map((source) => source.get());
    this.#value = compute();
  }

  get(): T {
    const inputs = this.#sources.map((source) => source.get());
    if (inputs.some((input, i) => !Object.is(input, this.#inputs[i]))) {
      this.#inputs = inputs;
      const next = this.#compute();
      if (!this.#equals(this.#value, next)) this.#value = next;
    }
    return this.#value;
  }

  subscribe(listener: () => void): Disposable {
    const store = new DisposableStore();
    let last = this.get();
    for (const source of this.#sources) {
      store.add(
        source.subscribe(() => {
          const next = this.get();
          if (next === last) return;
          last = next;
          listener();
        }),
      );
    }
    return store;
  }
}

export function computed<T>(
  sources: readonly ReadableStore<unknown>[],
  compute: () => T,
  equals?: Equality<T>,
): ComputedStore<T> {
  return new ComputedStore(sources, compute, equals);
}
