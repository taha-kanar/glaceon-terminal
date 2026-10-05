import type { EnvironmentRecord } from './shell-environment';

export interface ShellProfile {
  readonly file: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
}

export const FALLBACK_SHELL = '/bin/zsh';

/** The user's login shell, started as a login shell so PATH is complete even when launched from Finder. */
export function defaultShellProfile(input: {
  readonly env: EnvironmentRecord;
  readonly shellEnv: Readonly<Record<string, string>>;
  readonly homeDirectory: string;
}): ShellProfile {
  const shell = input.env['SHELL'];
  return {
    file: shell !== undefined && shell.length > 0 ? shell : FALLBACK_SHELL,
    args: ['-l'],
    cwd: input.homeDirectory,
    env: input.shellEnv,
  };
}
