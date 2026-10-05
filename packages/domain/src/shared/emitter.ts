import { toDisposable, type Disposable } from './disposable';

export type Listener<T> = (value: T) => void;

/** A typed event source. Listeners added during an emit are not called for that emit. */
export class Emitter<T> {
  readonly #listeners = new Set<Listener<T>>();

  get size(): number {
    return this.#listeners.size;
  }

  on(listener: Listener<T>): Disposable {
    this.#listeners.add(listener);
    return toDisposable(() => this.#listeners.delete(listener));
  }

  emit(value: T): void {
    for (const listener of [...this.#listeners]) listener(value);
  }

  clear(): void {
    this.#listeners.clear();
  }
}

/** One emitter per key, created on demand and dropped when its last listener leaves. */
export class KeyedEmitter<K, T> {
  readonly #emitters = new Map<K, Emitter<T>>();

  on(key: K, listener: Listener<T>): Disposable {
    let emitter = this.#emitters.get(key);
    if (emitter === undefined) {
      emitter = new Emitter<T>();
      this.#emitters.set(key, emitter);
    }
    const subscription = emitter.on(listener);
    return toDisposable(() => {
      subscription.dispose();
      if (emitter.size === 0) this.#emitters.delete(key);
    });
  }

  emit(key: K, value: T): void {
    this.#emitters.get(key)?.emit(value);
  }

  size(key: K): number {
    return this.#emitters.get(key)?.size ?? 0;
  }

  delete(key: K): void {
    this.#emitters.delete(key);
  }
}
