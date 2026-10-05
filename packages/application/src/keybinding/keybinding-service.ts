import { chordsFromKeyInput, type KeyInput } from '@glaceon/domain';
import type { CommandRegistry } from '../command/command-registry';
import { computed, type ReadableStore } from '../store/store';
import type { ContextKeys } from './context-keys';
import { KeybindingResolver } from './keybinding-resolver';
import type { KeybindingEntry } from '@glaceon/domain';

export interface KeybindingServiceDeps {
  readonly registry: CommandRegistry;
  readonly context: ContextKeys;
  readonly userBindings: ReadableStore<readonly KeybindingEntry[]>;
}

/** Turns key presses into command executions using the current keybinding map. */
export class KeybindingService {
  readonly #deps: KeybindingServiceDeps;
  readonly resolver: ReadableStore<KeybindingResolver>;

  constructor(deps: KeybindingServiceDeps) {
    this.#deps = deps;
    this.resolver = computed(
      [deps.userBindings],
      () => new KeybindingResolver(deps.userBindings.get()),
    );
  }

  /** Returns true when the key press ran a command (the caller should then swallow the event). */
  handleKey(input: KeyInput): boolean {
    const chords = chordsFromKeyInput(input);
    if (chords.length === 0) return false;
    const { registry, context } = this.#deps;
    const binding = this.resolver.get().resolve(chords, (key) => context.is(key));
    if (binding === undefined || !registry.has(binding.command)) return false;
    return registry.execute(binding.command, binding.args);
  }
}
