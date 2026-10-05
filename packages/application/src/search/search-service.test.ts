import { asPaneId, Emitter, type PaneId } from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from '../command/command-registry';
import { ContextKeys } from '../keybinding/context-keys';
import {
  SearchService,
  type SearchablePane,
  type SearchOptions,
  type SearchResults,
} from './search-service';

class FakeSearchable implements SearchablePane {
  readonly calls: { query: string; options: SearchOptions & { backwards: boolean } }[] = [];
  readonly results = new Emitter<SearchResults>();
  cleared = 0;
  find(query: string, options: SearchOptions & { backwards: boolean }): void {
    this.calls.push({ query, options });
    this.results.emit({ index: 0, count: query.length });
  }
  clearSearch(): void {
    this.cleared++;
  }
  onSearchResults(listener: (results: SearchResults) => void) {
    return this.results.on(listener);
  }
}

function setup() {
  const panes = new Map<PaneId, FakeSearchable>([
    [asPaneId('a'), new FakeSearchable()],
    [asPaneId('b'), new FakeSearchable()],
  ]);
  let active: PaneId | undefined = asPaneId('a');
  const context = new ContextKeys();
  const onClose = vi.fn();
  const search = new SearchService({
    targets: { searchable: (pane) => panes.get(pane) },
    context,
    activePane: () => active,
    onClose,
  });
  return { panes, search, context, onClose, setActive: (p: PaneId | undefined) => (active = p) };
}

describe('SearchService', () => {
  it('searches the active pane as the query and options change', () => {
    const { panes, search, context } = setup();
    search.open();
    expect(context.is('searchOpen')).toBe(true);
    search.setQuery('err');
    search.toggle('caseSensitive');
    search.previous();
    const a = panes.get(asPaneId('a'))!;
    expect(a.calls.map((c) => [c.query, c.options.caseSensitive, c.options.backwards])).toEqual([
      ['err', false, false],
      ['err', true, false],
      ['err', true, true],
    ]);
    expect(search.state.get()?.results).toEqual({ index: 0, count: 3 });
  });

  it('clears highlights for an empty query and on close', () => {
    const { panes, search, onClose, context } = setup();
    search.open();
    search.setQuery('x');
    search.setQuery('');
    expect(search.state.get()?.results).toEqual({ index: -1, count: 0 });
    search.close();
    expect(panes.get(asPaneId('a'))!.cleared).toBe(2);
    expect(search.state.get()).toBeUndefined();
    expect(context.is('searchOpen')).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
    search.close();
  });

  it('follows the active pane when reopened and remembers the query', () => {
    const { panes, search, setActive } = setup();
    search.open();
    search.setQuery('todo');
    setActive(asPaneId('b'));
    search.open();
    expect(search.state.get()).toMatchObject({ pane: 'b', query: 'todo', results: { count: 4 } });
    expect(panes.get(asPaneId('a'))!.cleared).toBe(1);
    const token = search.state.get()!.focusToken;
    search.open();
    expect(search.state.get()!.focusToken).toBe(token + 1);
  });

  it('next and previous open the bar when it is closed; commands are registered', () => {
    const { search, setActive } = setup();
    const registry = new CommandRegistry();
    registry.registerContribution(search);
    registry.execute('search.next');
    expect(search.state.get()).toBeDefined();
    registry.execute('search.close');
    registry.execute('search.previous');
    expect(search.state.get()).toBeDefined();
    search.close();
    setActive(undefined);
    registry.execute('search.open');
    expect(search.state.get()).toBeUndefined();
    search.setQuery('x');
    search.toggle('regex');
  });
});
