import { CommandIds, type Disposable, type PaneId } from '@glaceon/domain';
import type { Command, CommandContribution } from '../command/command';
import type { ContextKeys } from '../keybinding/context-keys';
import { ObservableStore, type ReadableStore } from '../store/store';

export interface SearchOptions {
  readonly caseSensitive: boolean;
  readonly regex: boolean;
  readonly wholeWord: boolean;
}

export interface SearchResults {
  /** 0-based index of the highlighted match, or -1 when none is selected. */
  readonly index: number;
  readonly count: number;
}

/** A terminal that can be searched (implemented by the xterm view). */
export interface SearchablePane {
  find(query: string, options: SearchOptions & { readonly backwards: boolean }): void;
  clearSearch(): void;
  onSearchResults(listener: (results: SearchResults) => void): Disposable;
}

export interface SearchTargets {
  searchable(pane: PaneId): SearchablePane | undefined;
}

export interface SearchState {
  readonly pane: PaneId;
  readonly query: string;
  readonly options: SearchOptions;
  readonly results?: SearchResults;
  /** Bumped on every open so the UI can re-focus and select the input. */
  readonly focusToken: number;
}

export const SEARCH_OPEN_CONTEXT = 'searchOpen';

const DEFAULT_OPTIONS: SearchOptions = { caseSensitive: false, regex: false, wholeWord: false };

export interface SearchServiceDeps {
  readonly targets: SearchTargets;
  readonly context: ContextKeys;
  readonly activePane: () => PaneId | undefined;
  readonly onClose: () => void;
}

/** Find-in-terminal for the active pane. */
export class SearchService implements CommandContribution {
  readonly #deps: SearchServiceDeps;
  readonly #state = new ObservableStore<SearchState | undefined>(undefined);
  #results: Disposable | undefined;
  #token = 0;

  constructor(deps: SearchServiceDeps) {
    this.#deps = deps;
  }

  get state(): ReadableStore<SearchState | undefined> {
    return this.#state;
  }

  open(): void {
    const pane = this.#deps.activePane();
    if (pane === undefined) return;
    const current = this.#state.get();
    if (current?.pane !== pane) this.#bind(pane);
    this.#state.set({
      pane,
      query: current?.query ?? '',
      options: current?.options ?? DEFAULT_OPTIONS,
      focusToken: ++this.#token,
    });
    this.#deps.context.set(SEARCH_OPEN_CONTEXT, true);
    if (current !== undefined && current.query !== '') this.#find(false);
  }

  close(): void {
    const current = this.#state.get();
    if (current === undefined) return;
    this.#deps.targets.searchable(current.pane)?.clearSearch();
    this.#results?.dispose();
    this.#results = undefined;
    this.#state.set(undefined);
    this.#deps.context.set(SEARCH_OPEN_CONTEXT, false);
    this.#deps.onClose();
  }

  setQuery(query: string): void {
    const current = this.#state.get();
    if (current === undefined || current.query === query) return;
    this.#state.set({ ...current, query });
    this.#find(false);
  }

  toggle(option: keyof SearchOptions): void {
    const current = this.#state.get();
    if (current === undefined) return;
    this.#state.set({
      ...current,
      options: { ...current.options, [option]: !current.options[option] },
    });
    this.#find(false);
  }

  next(): void {
    if (this.#state.get() === undefined) this.open();
    else this.#find(false);
  }

  previous(): void {
    if (this.#state.get() === undefined) this.open();
    else this.#find(true);
  }

  commands(): readonly Command[] {
    return [
      { id: CommandIds.searchOpen, title: 'Find', category: 'Terminal', run: () => this.open() },
      {
        id: CommandIds.searchNext,
        title: 'Find Next',
        category: 'Terminal',
        run: () => this.next(),
      },
      {
        id: CommandIds.searchPrevious,
        title: 'Find Previous',
        category: 'Terminal',
        run: () => this.previous(),
      },
      {
        id: CommandIds.searchClose,
        title: 'Close Find',
        category: 'Terminal',
        hideInPalette: true,
        run: () => this.close(),
      },
    ];
  }

  #bind(pane: PaneId): void {
    const previous = this.#state.get();
    if (previous !== undefined) this.#deps.targets.searchable(previous.pane)?.clearSearch();
    this.#results?.dispose();
    this.#results = this.#deps.targets.searchable(pane)?.onSearchResults((results) => {
      const current = this.#state.get();
      if (current?.pane === pane) this.#state.set({ ...current, results });
    });
  }

  #find(backwards: boolean): void {
    const current = this.#state.get();
    if (current === undefined) return;
    const target = this.#deps.targets.searchable(current.pane);
    if (current.query === '') {
      target?.clearSearch();
      this.#state.set({ ...current, results: { index: -1, count: 0 } });
      return;
    }
    target?.find(current.query, { ...current.options, backwards });
  }
}
