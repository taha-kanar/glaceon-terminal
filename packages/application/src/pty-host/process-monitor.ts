import {
  cpuPercent,
  Emitter,
  processName,
  toDisposable,
  type Disposable,
  type ProcessInfo,
  type ProcessSample,
  type ProcessSignal,
} from '@glaceon/domain';
import type { Scheduler } from '../ports/scheduler';

/** The OS process table (one `ps` call per sample). */
export interface ProcessTable {
  /** Resolves undefined when the table could not be read. */
  sample(): Promise<readonly ProcessSample[] | undefined>;
}

export interface ProcessSignaller {
  /** Returns false when the process could not be signalled (e.g. it is gone). */
  signal(pid: number, signal: ProcessSignal): boolean;
}

export interface ProcessMonitorDeps {
  readonly table: ProcessTable;
  readonly scheduler: Scheduler;
  readonly now: () => number;
  readonly intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 1500;

/**
 * Samples the process table while anyone listens and computes CPU usage from the change in
 * CPU time between samples. With no listeners nothing is polled.
 */
export class ProcessMonitor {
  readonly #deps: ProcessMonitorDeps;
  readonly #updates = new Emitter<readonly ProcessInfo[]>();
  #previous = new Map<number, number>();
  #previousAt = 0;
  #timer: Disposable | undefined;
  #busy = false;
  #latest: readonly ProcessInfo[] = [];

  constructor(deps: ProcessMonitorDeps) {
    this.#deps = deps;
  }

  /** The most recent sample (empty before the first one). */
  get latest(): readonly ProcessInfo[] {
    return this.#latest;
  }

  subscribe(listener: (processes: readonly ProcessInfo[]) => void): Disposable {
    const subscription = this.#updates.on(listener);
    if (this.#timer === undefined) {
      this.#timer = this.#deps.scheduler.setInterval(() => {
        void this.#tick();
      }, this.#deps.intervalMs ?? DEFAULT_INTERVAL_MS);
      void this.#tick();
    }
    return toDisposable(() => {
      subscription.dispose();
      if (this.#updates.size === 0) this.#stop();
    });
  }

  #stop(): void {
    this.#timer?.dispose();
    this.#timer = undefined;
    this.#previous = new Map();
  }

  async #tick(): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    try {
      const samples = await this.#deps.table.sample();
      if (samples === undefined || this.#timer === undefined) return;
      const now = this.#deps.now();
      const elapsed = now - this.#previousAt;
      this.#latest = samples.map((sample) =>
        toInfo(sample, this.#previous.get(sample.pid), elapsed),
      );
      this.#previous = new Map(samples.map((sample) => [sample.pid, sample.cpuTimeMs]));
      this.#previousAt = now;
      this.#updates.emit(this.#latest);
    } finally {
      this.#busy = false;
    }
  }
}

function toInfo(
  sample: ProcessSample,
  previousMs: number | undefined,
  elapsedMs: number,
): ProcessInfo {
  return {
    pid: sample.pid,
    ppid: sample.ppid,
    name: processName(sample.args),
    args: sample.args,
    cpu: cpuPercent(previousMs, sample.cpuTimeMs, elapsedMs),
    memoryKb: sample.memoryKb,
    foreground: sample.pgid === sample.tpgid,
    stopped: sample.stat.startsWith('T'),
  };
}
