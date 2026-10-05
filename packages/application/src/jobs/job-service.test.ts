import { asPaneId, Emitter, type ProcessInfo, type ProcessSignal } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { ObservableStore } from '../store/store';
import type { SessionInfoMap } from '../terminal/session-manager';
import { JobService } from './job-service';
import type { ProcessMonitorPort, ShellProcesses } from './process-monitor-port';

class FakeMonitor implements ProcessMonitorPort {
  readonly updates = new Emitter<readonly ShellProcesses[]>();
  readonly signals: [number, ProcessSignal][] = [];
  watchProcesses(listener: (shells: readonly ShellProcesses[]) => void) {
    return this.updates.on(listener);
  }
  signal(pid: number, signal: ProcessSignal): void {
    this.signals.push([pid, signal]);
  }
}

const proc = (pid: number, cpu: number): ProcessInfo => ({
  pid,
  ppid: 1,
  name: `p${String(pid)}`,
  args: '',
  cpu,
  memoryKb: 100,
  foreground: false,
  stopped: false,
});

describe('JobService', () => {
  it('maps shell trees to panes and polls only while watched', () => {
    const monitor = new FakeMonitor();
    const a = asPaneId('a');
    const sessions = new ObservableStore<SessionInfoMap>(
      new Map([
        [a, { pid: 10 }],
        [asPaneId('dead'), { pid: 20, exit: { exitCode: 0 } }],
      ]),
    );
    const jobs = new JobService({ monitor, sessions });
    expect(monitor.updates.size).toBe(0);

    const first = jobs.watch();
    const second = jobs.watch();
    expect(monitor.updates.size).toBe(1);
    monitor.updates.emit([
      { shellPid: 10, processes: [proc(10, 1), proc(11, 49)] },
      { shellPid: 20, processes: [proc(20, 0)] },
      { shellPid: 99, processes: [] },
    ]);
    expect([...jobs.jobs.get().keys()]).toEqual([a]);
    expect(jobs.jobs.get().get(a)).toMatchObject({ cpu: 50, memoryKb: 200 });

    first.dispose();
    first.dispose();
    expect(jobs.watching).toBe(true);
    second.dispose();
    expect(jobs.watching).toBe(false);
    expect(monitor.updates.size).toBe(0);
    expect(jobs.jobs.get().size).toBe(0);

    jobs.signal(11, 'SIGINT');
    expect(monitor.signals).toEqual([[11, 'SIGINT']]);
  });
});
