import { execFile } from 'node:child_process';
import type { ProcessSignaller, ProcessTable } from '@glaceon/application';
import { parseCpuTime, type ProcessSample, type ProcessSignal } from '@glaceon/domain';

const COLUMNS = 'pid=,ppid=,pgid=,tpgid=,stat=,time=,rss=,tty=,args=';
const ROW = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(.*)$/;

/** Parses `ps -o pid=,ppid=,pgid=,tpgid=,stat=,time=,rss=,tty=,args=`; skips processes without a terminal. */
export function parsePsTable(output: string): ProcessSample[] {
  const rows: ProcessSample[] = [];
  for (const line of output.split('\n')) {
    const match = ROW.exec(line);
    if (match === null) continue;
    const [, pid, ppid, pgid, tpgid, stat, time, rss, tty, args] = match;
    if (tty === undefined || tty === '??') continue;
    rows.push({
      pid: Number(pid),
      ppid: Number(ppid),
      pgid: Number(pgid),
      tpgid: Number(tpgid),
      stat: stat ?? '',
      cpuTimeMs: parseCpuTime(time ?? ''),
      memoryKb: Number(rss),
      tty,
      args: (args ?? '').trim(),
    });
  }
  return rows;
}

/** One `ps` call per sample for every process that has a terminal. */
export class MacProcessTable implements ProcessTable {
  readonly #timeoutMs: number;

  constructor(timeoutMs = 2000) {
    this.#timeoutMs = timeoutMs;
  }

  sample(): Promise<readonly ProcessSample[] | undefined> {
    return new Promise((resolve) => {
      execFile(
        '/bin/ps',
        ['-A', '-ww', '-o', COLUMNS],
        { timeout: this.#timeoutMs, maxBuffer: 8 * 1024 * 1024 },
        (error, stdout) => {
          resolve(error === null ? parsePsTable(stdout) : undefined);
        },
      );
    });
  }
}

export class NodeProcessSignaller implements ProcessSignaller {
  signal(pid: number, signal: ProcessSignal): boolean {
    try {
      return process.kill(pid, signal);
    } catch {
      return false;
    }
  }
}
