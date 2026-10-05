import { CommandIds, fuzzyFilter, type FuzzyMatch } from '@glaceon/domain';
import type { CommandInvocation, DynamicCommandProvider } from '../command/command';
import type { CommandRegistry } from '../command/command-registry';
import type { KeybindingResolver } from '../keybinding/keybinding-resolver';
import type { OverlayService } from '../overlay/overlay-service';
import type { ReadableStore } from '../store/store';

export interface PaletteItem {
  readonly invocation: CommandInvocation;
  /** `Category: Title`, the text that is searched and shown. */
  readonly label: string;
  readonly keybinding?: string;
  readonly match: FuzzyMatch;
}

export interface PaletteServiceDeps {
  readonly registry: CommandRegistry;
  readonly providers: readonly DynamicCommandProvider[];
  readonly keybindings: ReadableStore<KeybindingResolver>;
  readonly overlay: OverlayService;
}

const RECENT_LIMIT = 8;
const labelOf = (invocation: CommandInvocation): string =>
  invocation.category === undefined
    ? invocation.title
    : `${invocation.category}: ${invocation.title}`;

/** Lists and runs everything the command palette offers. */
export class PaletteService {
  readonly #deps: PaletteServiceDeps;
  #recent: string[] = [];

  constructor(deps: PaletteServiceDeps) {
    this.#deps = deps;
  }

  #invocations(): CommandInvocation[] {
    const statics = this.#deps.registry
      .list()
      .filter(
        (command) => command.hideInPalette !== true && command.id !== CommandIds.paletteToggle,
      )
      .map(({ id, title, category }) =>
        category === undefined ? { id, title, command: id } : { id, title, category, command: id },
      );
    const dynamic = this.#deps.providers.flatMap((provider) => provider.invocations());
    return [...statics, ...dynamic].filter((invocation) =>
      this.#deps.registry.has(invocation.command),
    );
  }

  /** Matching items, best first. With an empty query, recently run items come first. */
  items(query: string): PaletteItem[] {
    const resolver = this.#deps.keybindings.get();
    let invocations = this.#invocations();
    if (query.trim() === '') {
      const rank = (id: string): number => {
        const index = this.#recent.indexOf(id);
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
      };
      invocations = invocations
        .map((invocation, order) => ({ invocation, order }))
        .sort((a, b) => rank(a.invocation.id) - rank(b.invocation.id) || a.order - b.order)
        .map(({ invocation }) => invocation);
    }
    return fuzzyFilter(invocations, query, labelOf).map(({ item, match }) => {
      const keybinding = resolver.labelFor(item.command, item.args);
      const base = { invocation: item, label: labelOf(item), match };
      return keybinding === undefined ? base : { ...base, keybinding };
    });
  }

  run(item: PaletteItem): void {
    const { invocation } = item;
    this.#recent = [invocation.id, ...this.#recent.filter((id) => id !== invocation.id)].slice(
      0,
      RECENT_LIMIT,
    );
    this.#deps.overlay.close();
    this.#deps.registry.execute(invocation.command, invocation.args);
  }
}
