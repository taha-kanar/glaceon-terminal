/** Optional argument a command receives from a keybinding, menu or UI click. */
export type CommandArgs = string | number | undefined;

export interface Command {
  readonly id: string;
  /** Human readable title, shown in the palette and menus. */
  readonly title: string;
  readonly category?: string;
  run(args?: CommandArgs): void | Promise<void>;
}

/** A feature's set of commands (open/closed: new features add contributions, not switch cases). */
export interface CommandContribution {
  commands(): readonly Command[];
}
