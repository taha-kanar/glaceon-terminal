import type { Disposable, Result, Snippet } from '@glaceon/domain';
import { ObservableStore, type ReadableStore } from '../store/store';

/** Where snippets come from (a JSONC file in the config directory). */
export interface SnippetSource {
  read(): Promise<Result<readonly Snippet[], string>>;
  watch(onChange: () => void): Disposable;
}

export interface SnippetLibraryState {
  readonly snippets: readonly Snippet[];
  /** Why the file could not be used; the last good snippets stay available. */
  readonly problem?: string;
}

export class SnippetLibrary {
  readonly #source: SnippetSource;
  readonly #state = new ObservableStore<SnippetLibraryState>({ snippets: [] });
  #watching: Disposable | undefined;

  constructor(source: SnippetSource) {
    this.#source = source;
  }

  get state(): ReadableStore<SnippetLibraryState> {
    return this.#state;
  }

  async start(): Promise<void> {
    await this.reload();
    this.#watching = this.#source.watch(() => {
      void this.reload();
    });
  }

  async reload(): Promise<void> {
    const result = await this.#source.read();
    this.#state.set(
      result.ok
        ? { snippets: result.value }
        : { snippets: this.#state.get().snippets, problem: result.error },
    );
  }

  dispose(): void {
    this.#watching?.dispose();
  }
}
