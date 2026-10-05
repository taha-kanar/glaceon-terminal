import {
  chordId,
  DEFAULT_KEYBINDINGS,
  evaluateWhen,
  formatChord,
  parseChord,
  parseWhen,
  type ContextLookup,
  type KeybindingEntry,
  type KeyChord,
  type WhenExpr,
} from '@glaceon/domain';
import type { CommandArgs } from '../command/command';

export interface ResolvedKeybinding {
  readonly chord: KeyChord;
  readonly command: string;
  readonly args?: CommandArgs;
  readonly when?: WhenExpr;
}

function compile(entry: KeybindingEntry): ResolvedKeybinding | string {
  const chord = parseChord(entry.key);
  if (chord === undefined) return `Invalid key "${entry.key}" for ${entry.command}`;
  const binding = { chord, command: entry.command, args: entry.args };
  if (entry.when === undefined) return binding;
  const when = parseWhen(entry.when);
  if (!when.ok) return `Invalid when "${entry.when}" for ${entry.command}: ${when.error}`;
  return { ...binding, when: when.value };
}

function removes(entry: KeybindingEntry, binding: ResolvedKeybinding): boolean {
  if (`-${binding.command}` !== entry.command) return false;
  if (entry.key === '') return true;
  const chord = parseChord(entry.key);
  return chord !== undefined && chordId(chord) === chordId(binding.chord);
}

/**
 * Default keybindings overlaid with the user's. Later entries win; an entry whose command starts
 * with `-` removes earlier bindings of that command (only for `key`, when one is given).
 */
export class KeybindingResolver {
  readonly #bindings: ResolvedKeybinding[] = [];
  readonly problems: readonly string[];

  constructor(
    user: readonly KeybindingEntry[],
    defaults: readonly KeybindingEntry[] = DEFAULT_KEYBINDINGS,
  ) {
    const problems: string[] = [];
    for (const entry of [...defaults, ...user]) {
      if (entry.command.startsWith('-')) {
        const kept = this.#bindings.filter((binding) => !removes(entry, binding));
        this.#bindings.splice(0, this.#bindings.length, ...kept);
        continue;
      }
      const compiled = compile(entry);
      if (typeof compiled === 'string') problems.push(compiled);
      else this.#bindings.push(compiled);
    }
    this.problems = problems;
  }

  /** The winning binding for the first candidate chord that has an enabled binding. */
  resolve(chords: readonly KeyChord[], context: ContextLookup): ResolvedKeybinding | undefined {
    for (const chord of chords) {
      const id = chordId(chord);
      for (let i = this.#bindings.length - 1; i >= 0; i--) {
        const binding = this.#bindings[i];
        if (binding === undefined || chordId(binding.chord) !== id) continue;
        if (binding.when === undefined || evaluateWhen(binding.when, context)) return binding;
      }
    }
    return undefined;
  }

  /** The chord shown next to a command in menus and the palette (the most recent binding). */
  chordFor(command: string, args?: CommandArgs): KeyChord | undefined {
    for (let i = this.#bindings.length - 1; i >= 0; i--) {
      const binding = this.#bindings[i];
      if (binding?.command === command && binding.args === args) return binding.chord;
    }
    return undefined;
  }

  labelFor(command: string, args?: CommandArgs): string | undefined {
    const chord = this.chordFor(command, args);
    return chord === undefined ? undefined : formatChord(chord);
  }

  all(): readonly ResolvedKeybinding[] {
    return this.#bindings;
  }
}
