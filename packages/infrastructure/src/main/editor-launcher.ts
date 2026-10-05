import { spawn } from 'node:child_process';
import { err, ok, type Result } from '@glaceon/domain';

export interface EditorLauncherOptions {
  /** Login shell used to get the user's full PATH (apps started from Finder have a bare one). */
  readonly shell: string;
  /** How long to wait for an immediate failure such as "command not found". */
  readonly settleMs?: number;
}

/**
 * Starts an editor from an argv (never a shell string: arguments are passed through `"$@"`).
 * Editors that keep running count as success; exit code 127 means the command was not found.
 */
export class EditorLauncher {
  readonly #shell: string;
  readonly #settleMs: number;

  constructor(options: EditorLauncherOptions) {
    this.#shell = options.shell;
    this.#settleMs = options.settleMs ?? 1500;
  }

  launch(argv: readonly string[]): Promise<Result<void, string>> {
    const [command] = argv;
    if (command === undefined || command === '')
      return Promise.resolve(err('The editor command is empty'));
    return new Promise((resolve) => {
      const child = spawn(this.#shell, ['-l', '-c', 'exec "$@"', 'glaceon-editor', ...argv], {
        detached: true,
        stdio: 'ignore',
      });
      const timer = setTimeout(() => {
        child.unref();
        resolve(ok(undefined));
      }, this.#settleMs);
      child.once('error', (error) => {
        clearTimeout(timer);
        resolve(err(`Cannot start the editor: ${error.message}`));
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        if (code === 0 || code === null) resolve(ok(undefined));
        else if (code === 127 || code === 126) resolve(err(`Editor "${command}" was not found`));
        else resolve(err(`Editor "${command}" exited with code ${String(code)}`));
      });
    });
  }
}
