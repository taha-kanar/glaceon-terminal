import type { HostConnection, PtySessionHost, SessionOutput } from '@glaceon/application';
import {
  decodePtyClientMessage,
  type PtyClientMessage,
  type PtyHostMessage,
} from '@glaceon/contracts';
import {
  asSessionId,
  normalizeTerminalSize,
  toDisposable,
  type Disposable,
  type PtyExit,
  type SessionId,
} from '@glaceon/domain';
import type { MainMessagePort } from './main-message-port';

class PortSessionOutput implements SessionOutput {
  readonly #port: MainMessagePort;

  constructor(port: MainMessagePort) {
    this.#port = port;
  }

  data(sessionId: SessionId, chunk: Uint8Array): void {
    this.#port.postMessage({ t: 'data', sid: sessionId, chunk } satisfies PtyHostMessage);
  }

  exit(sessionId: SessionId, exit: PtyExit): void {
    this.#port.postMessage({ t: 'exit', sid: sessionId, ...exit } satisfies PtyHostMessage);
  }
}

function dispatch(
  message: PtyClientMessage,
  target: { connection: HostConnection; port: MainMessagePort },
): void {
  const { connection, port } = target;
  const sessionId = asSessionId(message.sid);
  switch (message.t) {
    case 'spawn': {
      const result = connection.spawn({
        sessionId,
        size: normalizeTerminalSize(message),
        ...(message.cwd === undefined ? {} : { cwd: message.cwd }),
      });
      const reply: PtyHostMessage = result.ok
        ? { t: 'spawned', reqId: message.reqId, pid: result.value.pid }
        : { t: 'spawnFailed', reqId: message.reqId, message: result.error.message };
      port.postMessage(reply);
      return;
    }
    case 'input':
      connection.write(sessionId, message.data);
      return;
    case 'resize':
      connection.resize(sessionId, normalizeTerminalSize(message));
      return;
    case 'kill':
      connection.kill(sessionId);
      return;
  }
}

/**
 * Serves one renderer connection over a MessagePort. Disposing (or the renderer
 * going away) closes the connection and kills its sessions.
 */
export function servePtyConnection(port: MainMessagePort, host: PtySessionHost): Disposable {
  const connection = host.openConnection(new PortSessionOutput(port));
  const close = toDisposable(() => {
    host.closeConnection(connection);
    port.close();
  });
  port.on('message', ({ data }) => {
    const message = decodePtyClientMessage(data);
    if (message !== undefined) dispatch(message, { connection, port });
  });
  port.on('close', () => close.dispose());
  port.start();
  return close;
}
