import { HostConnection } from './host-connection';
import type { PtyProcessFactory } from './pty-process';
import type { SessionOutput } from './session-output';
import { SessionRegistry } from './session-registry';
import type { ShellProfile } from './shell-profile';

export interface PtySessionHostDeps {
  readonly processes: PtyProcessFactory;
  readonly shell: ShellProfile;
}

/** Entry point of the pty-host process: hands out one connection per client. */
export class PtySessionHost {
  readonly #deps: PtySessionHostDeps;
  readonly #registry = new SessionRegistry();
  readonly #connections = new Set<HostConnection>();

  constructor(deps: PtySessionHostDeps) {
    this.#deps = deps;
  }

  get sessionCount(): number {
    return this.#registry.size;
  }

  openConnection(output: SessionOutput): HostConnection {
    const connection = new HostConnection({ ...this.#deps, registry: this.#registry, output });
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
    this.#registry.killAll();
  }
}
