import { execFile } from 'node:child_process';
import type { ProcessInspector } from '@glaceon/application';

/** Parses `lsof -Fn` output: the cwd is the `n` field of the process's `cwd` descriptor. */
export function parseLsofCwd(output: string): string | undefined {
  for (const line of output.split('\n')) {
    if (line.startsWith('n') && line.length > 1) return line.slice(1);
  }
  return undefined;
}

/** `ps -o ucomm=` may print a path (`/bin/zsh`) or a login-shell name (`-zsh`); keep the bare name. */
export function parsePsCommand(output: string): string | undefined {
  const command = output.trim().replace(/^-/, '');
  if (command === '') return undefined;
  return command.slice(command.lastIndexOf('/') + 1);
}

function run(
  file: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: timeoutMs }, (error, stdout) => {
      resolve(error === null ? stdout : undefined);
    });
  });
}

/** macOS has no /proc: `lsof` and `ps` answer questions about other processes. */
export class MacProcessInspector implements ProcessInspector {
  readonly #timeoutMs: number;

  constructor(timeoutMs = 2000) {
    this.#timeoutMs = timeoutMs;
  }

  async cwdOf(pid: number): Promise<string | undefined> {
    const output = await run(
      '/usr/sbin/lsof',
      ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
      this.#timeoutMs,
    );
    return output === undefined ? undefined : parseLsofCwd(output);
  }

  async nameOf(pid: number): Promise<string | undefined> {
    // `ucomm` is the kernel's process name, the one node-pty reports for the foreground process.
    // `comm` follows argv[0] instead: `/bin/sh` for a shell that has become `bash`.
    const output = await run('/bin/ps', ['-o', 'ucomm=', '-p', String(pid)], this.#timeoutMs);
    return output === undefined ? undefined : parsePsCommand(output);
  }
}
