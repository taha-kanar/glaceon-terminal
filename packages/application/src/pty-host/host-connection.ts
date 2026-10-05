import { err, ok, type Result, type SessionId, type TerminalSize } from '@glaceon/domain';
import type { PtyError, SpawnedSession, SpawnRequest } from '../terminal/pty-port';
import type { PtyProcess, PtyProcessFactory } from './pty-process';
import type { SessionOutput } from './session-output';
import type { SessionRegistry } from './session-registry';
import type { ShellProfile } from './shell-profile';

export interface HostConnectionDeps {
  readonly processes: PtyProcessFactory;
  readonly shell: ShellProfile;
  readonly registry: SessionRegistry;
  readonly output: SessionOutput;
}

/** The sessions owned by one client (window). Closing the connection kills its sessions. */
export class HostConnection {
  readonly #deps: HostConnectionDeps;
  readonly #owned = new Set<SessionId>();
  #closed = false;

  constructor(deps: HostConnectionDeps) {
    this.#deps = deps;
  }

  spawn(request: SpawnRequest): Result<SpawnedSession, PtyError> {
    if (this.#closed) return err({ message: 'Connection is closed' });
    if (this.#deps.registry.has(request.sessionId)) {
      return err({ message: `Session ${request.sessionId} already exists` });
    }

    const started = this.#start(request);
    if (!started.ok) return started;

    this.#track(request.sessionId, started.value);
    return ok({ pid: started.value.pid });
  }

  write(sessionId: SessionId, data: string): void {
    this.#ownedProcess(sessionId)?.write(data);
  }

  resize(sessionId: SessionId, size: TerminalSize): void {
    this.#ownedProcess(sessionId)?.resize(size);
  }

  kill(sessionId: SessionId): void {
    this.#ownedProcess(sessionId)?.kill();
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const sessionId of this.#owned) {
      this.#deps.registry.get(sessionId)?.kill();
    }
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

  #track(sessionId: SessionId, ptyProcess: PtyProcess): void {
    const { registry, output } = this.#deps;
    const subscriptions = [
      ptyProcess.onData((chunk) => output.data(sessionId, chunk)),
      ptyProcess.onExit((exit) => {
        for (const subscription of subscriptions) subscription.dispose();
        registry.remove(sessionId);
        this.#owned.delete(sessionId);
        output.exit(sessionId, exit);
      }),
    ];
    registry.add(sessionId, ptyProcess);
    this.#owned.add(sessionId);
  }

  #ownedProcess(sessionId: SessionId): PtyProcess | undefined {
    return this.#owned.has(sessionId) ? this.#deps.registry.get(sessionId) : undefined;
  }
}
