export interface Disposable {
  dispose(): void;
}

export function toDisposable(dispose: () => void): Disposable {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      dispose();
    },
  };
}

/** Collects disposables and releases them in reverse order of registration. */
export class DisposableStore implements Disposable {
  readonly #items: Disposable[] = [];
  #disposed = false;

  get isDisposed(): boolean {
    return this.#disposed;
  }

  add<T extends Disposable>(item: T): T {
    if (this.#disposed) {
      item.dispose();
    } else {
      this.#items.push(item);
    }
    return item;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const item of this.#items.splice(0).reverse()) {
      item.dispose();
    }
  }
}
