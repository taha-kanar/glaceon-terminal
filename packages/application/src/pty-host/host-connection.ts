import {
  err,
  ok,
  type Disposable,
  type Result,
  type SessionId,
  type TerminalSize,
} from '@glaceon/domain';
import type { Scheduler } from '../ports/scheduler';
import type { PtyError, SpawnedSession, SpawnRequest } from '../terminal/pty-port';
import type { ProcessInspector } from './process-inspector';
import { HostSession, type FlowSettings } from './host-session';
import type { PtyProcess, PtyProcessFactory } from './pty-process';
import type { SessionOutput } from './session-output';
import type { SessionRegistry } from './session-registry';
import type { ShellProfile } from './shell-profile';

export interface HostServices {
  readonly processes: PtyProcessFactory;
  readonly shell: ShellProfile;
  readonly scheduler: Scheduler;
  readonly inspector: ProcessInspector;
  readonly flow?: FlowSettings;
}

export interface HostConnectionDeps extends HostServices {
  readonly registry: SessionRegistry;
  readonly output: SessionOutput;
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

    this.#track(request.sessionId, started.value);
    return ok({ pid: started.value.pid, shell: basename(this.#deps.shell.file) });
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

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#poll.dispose();
    for (const session of this.#owned.values()) session.kill();
  }

  #start(request: SpawnRequest): Result<PtyProcess, PtyError> {
    const { processes, shell } = this.#deps;
    try {
      return ok(
        processes.spawn({
          file: shell.file,
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

  #track(sessionId: SessionId, process: PtyProcess): void {
    const { registry, output, scheduler, flow, inspector, shell } = this.#deps;
    const session = new HostSession(sessionId, process, {
      scheduler,
      output,
      inspector,
      shellName: basename(shell.file),
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
