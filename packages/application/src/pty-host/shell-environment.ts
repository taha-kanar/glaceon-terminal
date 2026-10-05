export type EnvironmentRecord = Readonly<Record<string, string | undefined>>;

export interface ShellEnvironmentOptions {
  readonly termProgram: string;
  readonly termProgramVersion: string;
  readonly fallbackLang: string;
}

const STRIPPED_PREFIXES = ['ELECTRON_', 'VITE_'];
const STRIPPED_KEYS = new Set(['NODE_OPTIONS', 'NODE_ENV', 'ORIGINAL_XDG_CURRENT_DESKTOP']);

function isStripped(key: string): boolean {
  return STRIPPED_KEYS.has(key) || STRIPPED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * The environment a shell starts with: the app's own environment minus Electron/Node
 * internals, plus the variables terminal programs are expected to set.
 */
export function buildShellEnvironment(
  base: EnvironmentRecord,
  options: ShellEnvironmentOptions,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !isStripped(key)) {
      env[key] = value;
    }
  }
  env['TERM'] = 'xterm-256color';
  env['COLORTERM'] = 'truecolor';
  env['TERM_PROGRAM'] = options.termProgram;
  env['TERM_PROGRAM_VERSION'] = options.termProgramVersion;
  // Apps launched from Finder get no locale; without it zsh mangles UTF-8 input.
  env['LANG'] ??= options.fallbackLang;
  return env;
}
