/** Questions about OS processes the pty host needs answered (via `lsof`/`ps` on macOS). */
export interface ProcessInspector {
  cwdOf(pid: number): Promise<string | undefined>;
  /** Executable name of a process, e.g. `zsh`. */
  nameOf(pid: number): Promise<string | undefined>;
}
