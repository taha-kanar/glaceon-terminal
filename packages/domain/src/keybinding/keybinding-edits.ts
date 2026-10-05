import type { KeybindingEntry } from './keybinding';

/** User keybindings with every override of `command` removed (back to the defaults). */
export function resetKeybinding(
  entries: readonly KeybindingEntry[],
  command: string,
): KeybindingEntry[] {
  return entries.filter((entry) => entry.command !== command && entry.command !== `-${command}`);
}

/** User keybindings in which `command` is bound to `key` only (its defaults are removed). */
export function rebindKeybinding(
  entries: readonly KeybindingEntry[],
  change: { readonly command: string; readonly key: string },
): KeybindingEntry[] {
  return [
    ...resetKeybinding(entries, change.command),
    { key: '', command: `-${change.command}` },
    { key: change.key, command: change.command },
  ];
}

/** Removes every binding of `command`, defaults included. */
export function unbindKeybinding(
  entries: readonly KeybindingEntry[],
  command: string,
): KeybindingEntry[] {
  return [...resetKeybinding(entries, command), { key: '', command: `-${command}` }];
}
