import { HostConnection, type HostServices } from './host-connection';
import { DetachedSessions } from './detached-sessions';
import { ProcessMonitor, type ProcessTable } from './process-monitor';
import type { SessionOutput } from './session-output';
import { SessionRegistry } from './session-registry';

export interface PtySessionHostDeps extends HostServices {
  readonly table: ProcessTable;
  readonly now: () => number;
}

/** Entry point of the pty-host process: hands out one connection per client. */
export class PtySessionHost {
  readonly #deps: PtySessionHostDeps;
  readonly #registry = new SessionRegistry();
  readonly #connections = new Set<HostConnection>();
  readonly #monitor: ProcessMonitor;
  readonly #detached: DetachedSessions;

  constructor(deps: PtySessionHostDeps) {
    this.#deps = deps;
    this.#detached = new DetachedSessions(deps.scheduler);
    this.#monitor = new ProcessMonitor({
      table: deps.table,
      scheduler: deps.scheduler,
      now: deps.now,
    });
  }

  get sessionCount(): number {
    return this.#registry.size;
  }

  openConnection(output: SessionOutput): HostConnection {
    const connection = new HostConnection({
      ...this.#deps,
      registry: this.#registry,
      output,
      monitor: this.#monitor,
      detachedSessions: this.#detached,
    });
    this.#connections.add(connection);
    return connection;
  }

  closeConnection(connection: HostConnection): void {
    connection.close();
    this.#connections.delete(connection);
  }

  dispose(): void {
    for (const connection of this.#connections) connection.close();
    this.#connections.clear();
    this.#detached.killAll();
    this.#registry.killAll();
  }
}
