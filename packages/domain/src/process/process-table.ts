/** One row of the OS process table, as sampled for the terminals' TTYs. */
export interface ProcessSample {
  readonly pid: number;
  readonly ppid: number;
  readonly pgid: number;
  /** Foreground process group of the process's terminal. */
  readonly tpgid: number;
  readonly tty: string;
  /** `ps` state, e.g. `S+`, `R+`, `T`. */
  readonly stat: string;
  /** CPU time used so far, in milliseconds. */
  readonly cpuTimeMs: number;
  readonly memoryKb: number;
  readonly args: string;
}

/** A process with its CPU usage since the previous sample. */
export interface ProcessInfo {
  readonly pid: number;
  readonly ppid: number;
  readonly name: string;
  readonly args: string;
  /** Percent of one core (can exceed 100 for multi-threaded programs). */
  readonly cpu: number;
  readonly memoryKb: number;
  /** In the terminal's foreground process group (receives ⌃C). */
  readonly foreground: boolean;
  readonly stopped: boolean;
}

export const PROCESS_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGKILL'] as const;
export type ProcessSignal = (typeof PROCESS_SIGNALS)[number];

/** Program name from a command line: `/usr/bin/vim x` → `vim`, `-zsh` → `zsh`. */
export function processName(args: string): string {
  const first = args.trim().split(/\s+/, 1)[0] ?? '';
  const name = first.slice(first.lastIndexOf('/') + 1).replace(/^-/, '');
  return name === '' ? '?' : name;
}

/** Parses `ps` CPU time: `[[dd-]hh:]mm:ss[.cc]`. Returns 0 for anything else. */
export function parseCpuTime(text: string): number {
  const match = /^(?:(?:(\d+)-)?(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(text.trim());
  if (match === null) return 0;
  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
  const total = ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds);
  return Math.round(total * 1000);
}

/** CPU usage between two samples of a process's CPU time, as a percent of one core. */
export function cpuPercent(
  previousMs: number | undefined,
  currentMs: number,
  elapsedMs: number,
): number {
  if (previousMs === undefined || elapsedMs <= 0) return 0;
  return Math.max(0, ((currentMs - previousMs) / elapsedMs) * 100);
}

/** `root` and all of its descendants, parents before children (depth-first). */
export function descendants<T extends { readonly pid: number; readonly ppid: number }>(
  processes: readonly T[],
  root: number,
): T[] {
  const children = new Map<number, T[]>();
  for (const process of processes) {
    const siblings = children.get(process.ppid) ?? [];
    siblings.push(process);
    children.set(process.ppid, siblings);
  }
  const result: T[] = [];
  const visit = (pid: number, seen: Set<number>): void => {
    for (const child of children.get(pid) ?? []) {
      if (seen.has(child.pid)) continue;
      seen.add(child.pid);
      result.push(child);
      visit(child.pid, seen);
    }
  };
  const self = processes.find((process) => process.pid === root);
  if (self === undefined) return [];
  result.push(self);
  visit(root, new Set([root]));
  return result;
}

/** Depth of each process below `root` in a `descendants` list. */
export function depthOf(processes: readonly ProcessInfo[], pid: number): number {
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  let depth = 0;
  let current = byPid.get(pid);
  while (current !== undefined && byPid.has(current.ppid) && depth < 64) {
    depth++;
    current = byPid.get(current.ppid);
  }
  return depth;
}
