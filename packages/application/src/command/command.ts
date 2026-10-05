/** Optional argument a command receives from a keybinding, menu or UI click. */
export type CommandArgs = string | number | undefined;

export interface Command {
  readonly id: string;
  /** Human readable title, shown in the palette and menus. */
  readonly title: string;
  readonly category?: string;
  /** Hidden from the palette (e.g. commands that only make sense with arguments). */
  readonly hideInPalette?: boolean;
  run(args?: CommandArgs): void | Promise<void>;
}

/** A palette entry that runs a command with fixed arguments, e.g. "Theme: Nord". */
export interface CommandInvocation {
  /** Unique within the palette. */
  readonly id: string;
  readonly title: string;
  readonly category?: string;
  readonly command: string;
  readonly args?: CommandArgs;
}

/** Supplies invocations computed at the time the palette opens (themes, snippets …). */
export interface DynamicCommandProvider {
  invocations(): readonly CommandInvocation[];
}

/** A feature's set of commands (open/closed: new features add contributions, not switch cases). */
export interface CommandContribution {
  commands(): readonly Command[];
}
