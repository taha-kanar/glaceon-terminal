import {
  descendants,
  err,
  ok,
  type ProcessSignal,
  type Disposable,
  type Result,
  type SessionId,
  type TerminalSize,
} from '@glaceon/domain';
import type { Scheduler } from '../ports/scheduler';
import type { PtyError, SpawnedSession, SpawnRequest } from '../terminal/pty-port';
import type { DetachedSessions } from './detached-sessions';
import type { ProcessInspector } from './process-inspector';
import type { ProcessMonitor, ProcessSignaller } from './process-monitor';
import { HostSession, type FlowSettings } from './host-session';
import type { PtyProcess, PtyProcessFactory } from './pty-process';
import type { SessionOutput, SessionProcesses } from './session-output';
import type { SessionRegistry } from './session-registry';
import type { ShellProfile } from './shell-profile';

export interface HostServices {
  readonly processes: PtyProcessFactory;
  readonly shell: ShellProfile;
  readonly scheduler: Scheduler;
  readonly inspector: ProcessInspector;
  readonly signaller: ProcessSignaller;
  readonly flow?: FlowSettings;
}

export interface HostConnectionDeps extends HostServices {
  readonly registry: SessionRegistry;
  readonly output: SessionOutput;
  readonly monitor: ProcessMonitor;
  readonly detachedSessions: DetachedSessions;
}

/** How often foreground processes are polled, and how soon after Enter they are re-checked. */
const FOREGROUND_POLL_MS = 1000;
const FOREGROUND_AFTER_ENTER_MS = 150;

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The sessions owned by one client (window). Closing the connection kills its sessions. */
export class HostConnection {
  readonly #deps: HostConnectionDeps;
  readonly #owned = new Map<SessionId, HostSession>();
  readonly #poll: Disposable;
  #monitoring: Disposable | undefined;
  #reports: readonly SessionProcesses[] = [];
  #closed = false;

  constructor(deps: HostConnectionDeps) {
    this.#deps = deps;
    this.#poll = deps.scheduler.setInterval(() => {
      for (const session of this.#owned.values()) session.checkForeground();
    }, FOREGROUND_POLL_MS);
  }

  spawn(request: SpawnRequest): Result<SpawnedSession, PtyError> {
    if (this.#closed) return err({ message: 'Connection is closed' });
    if (this.#deps.registry.has(request.sessionId)) {
      return err({ message: `Session ${request.sessionId} already exists` });
    }

    const started = this.#start(request);
    if (!started.ok) return started;

    const shellName = basename(request.shell ?? this.#deps.shell.file);
    this.#track(request.sessionId, started.value, shellName);
    return ok({ pid: started.value.pid, shell: shellName });
  }

  write(sessionId: SessionId, data: string): void {
    const session = this.#owned.get(sessionId);
    if (session === undefined) return;
    session.write(data);
    if (data.includes('\r')) {
      this.#deps.scheduler.setTimeout(() => session.checkForeground(), FOREGROUND_AFTER_ENTER_MS);
    }
  }

  resize(sessionId: SessionId, size: TerminalSize): void {
    this.#owned.get(sessionId)?.resize(size);
  }

  kill(sessionId: SessionId): void {
    this.#owned.get(sessionId)?.kill();
  }

  acknowledge(sessionId: SessionId, bytes: number): void {
    this.#owned.get(sessionId)?.acknowledge(bytes);
  }

  async cwd(sessionId: SessionId): Promise<string | undefined> {
    const session = this.#owned.get(sessionId);
    if (session === undefined) return undefined;
    try {
      return await this.#deps.inspector.cwdOf(session.pid);
    } catch {
      return undefined;
    }
  }

  /**
   * Gives up a session without killing it so another connection can attach it. Output that
   * arrives meanwhile is buffered; `detached` is reported after all earlier output.
   */
  detach(sessionId: SessionId): boolean {
    const session = this.#owned.get(sessionId);
    if (session === undefined) return false;
    this.#owned.delete(sessionId);
    const buffer = this.#deps.detachedSessions.park(sessionId, session);
    session.detach(buffer, () => {
      this.#deps.registry.remove(sessionId);
    });
    this.#deps.output.detached(sessionId);
    return true;
  }

  /** Takes over a detached session (from this or another connection). */
  attach(sessionId: SessionId): Result<{ readonly pid: number }, PtyError> {
    if (this.#closed) return err({ message: 'Connection is closed' });
    const parked = this.#deps.detachedSessions.claim(sessionId);
    if (parked === undefined) return err({ message: `Session ${sessionId} is not detached` });
    this.#owned.set(sessionId, parked.session);
    parked.session.attach(parked.buffer, {
      output: this.#deps.output,
      onExit: () => {
        this.#deps.registry.remove(sessionId);
        this.#owned.delete(sessionId);
      },
    });
    return ok({ pid: parked.session.pid });
  }

  /** Starts or stops streaming the process trees of this connection's sessions. */
  monitor(on: boolean): void {
    if (this.#closed || on === (this.#monitoring !== undefined)) return;
    if (!on) {
      this.#monitoring?.dispose();
      this.#monitoring = undefined;
      return;
    }
    this.#monitoring = this.#deps.monitor.subscribe((processes) => {
      this.#reports = [...this.#owned].map(([sessionId, session]) => ({
        sessionId,
        pid: session.pid,
        processes: descendants(processes, session.pid),
      }));
      this.#deps.output.processes(this.#reports);
    });
  }

  /** Signals a process, but only one in the latest reported tree of this connection's sessions. */
  signal(pid: number, signal: ProcessSignal): boolean {
    const owned = this.#reports.some((report) =>
      report.processes.some((process) => process.pid === pid),
    );
    return owned && this.#deps.signaller.signal(pid, signal);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#poll.dispose();
    this.#monitoring?.dispose();
    this.#monitoring = undefined;
    for (const session of this.#owned.values()) session.kill();
  }

  #start(request: SpawnRequest): Result<PtyProcess, PtyError> {
    const { processes, shell } = this.#deps;
    try {
      return ok(
        processes.spawn({
          file: request.shell ?? shell.file,
          args: shell.args,
          cwd: request.cwd ?? shell.cwd,
          env: shell.env,
          size: request.size,
        }),
      );
    } catch (error) {
      return err({ message: error instanceof Error ? error.message : String(error) });
    }
  }

  #track(sessionId: SessionId, process: PtyProcess, shellName: string): void {
    const { registry, output, scheduler, flow, inspector } = this.#deps;
    const session = new HostSession(sessionId, process, {
      scheduler,
      output,
      inspector,
      shellName,
      ...(flow === undefined ? {} : { flow }),
      onExit: () => {
        registry.remove(sessionId);
        this.#owned.delete(sessionId);
      },
    });
    registry.add(sessionId, process);
    this.#owned.set(sessionId, session);
  }
}
