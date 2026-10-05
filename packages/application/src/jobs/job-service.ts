import {
  toDisposable,
  type Disposable,
  type PaneId,
  type ProcessInfo,
  type ProcessSignal,
} from '@glaceon/domain';
import { ObservableStore, type ReadableStore } from '../store/store';
import type { SessionInfoMap } from '../terminal/session-manager';
import type { ProcessMonitorPort, ShellProcesses } from './process-monitor-port';

export interface PaneJobs {
  /** The shell first, then everything it started. */
  readonly processes: readonly ProcessInfo[];
  /** CPU of the whole tree, percent of one core. */
  readonly cpu: number;
  readonly memoryKb: number;
}

export type JobsMap = ReadonlyMap<PaneId, PaneJobs>;

export interface JobServiceDeps {
  readonly monitor: ProcessMonitorPort;
  readonly sessions: ReadableStore<SessionInfoMap>;
}

/**
 * Process trees per pane for the job panel and the process popover. Polling runs only while
 * at least one of them is watching.
 */
export class JobService {
  readonly #deps: JobServiceDeps;
  readonly #jobs = new ObservableStore<JobsMap>(new Map());
  #watchers = 0;
  #subscription: Disposable | undefined;

  constructor(deps: JobServiceDeps) {
    this.#deps = deps;
  }

  get jobs(): ReadableStore<JobsMap> {
    return this.#jobs;
  }

  get watching(): boolean {
    return this.#subscription !== undefined;
  }

  watch(): Disposable {
    this.#watchers++;
    this.#subscription ??= this.#deps.monitor.watchProcesses((shells) => {
      this.#jobs.set(this.#byPane(shells));
    });
    let disposed = false;
    return toDisposable(() => {
      if (disposed) return;
      disposed = true;
      this.#watchers--;
      if (this.#watchers > 0) return;
      this.#subscription?.dispose();
      this.#subscription = undefined;
      this.#jobs.set(new Map());
    });
  }

  signal(pid: number, signal: ProcessSignal): void {
    this.#deps.monitor.signal(pid, signal);
  }

  #byPane(shells: readonly ShellProcesses[]): JobsMap {
    const paneOfPid = new Map<number, PaneId>();
    for (const [pane, info] of this.#deps.sessions.get()) {
      if (info.pid !== undefined && info.exit === undefined) paneOfPid.set(info.pid, pane);
    }
    const jobs = new Map<PaneId, PaneJobs>();
    for (const { shellPid, processes } of shells) {
      const pane = paneOfPid.get(shellPid);
      if (pane === undefined) continue;
      jobs.set(pane, {
        processes,
        cpu: processes.reduce((sum, process) => sum + process.cpu, 0),
        memoryKb: processes.reduce((sum, process) => sum + process.memoryKb, 0),
      });
    }
    return jobs;
  }
}
