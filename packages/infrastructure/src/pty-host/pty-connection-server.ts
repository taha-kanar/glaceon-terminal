import type {
  ForegroundProcess,
  HostConnection,
  PtySessionHost,
  SessionOutput,
  SessionProcesses,
} from '@glaceon/application';
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

  process(sessionId: SessionId, process: ForegroundProcess): void {
    this.#port.postMessage({ t: 'process', sid: sessionId, ...process } satisfies PtyHostMessage);
  }

  processes(reports: readonly SessionProcesses[]): void {
    const sessions = reports.map(({ sessionId, pid, processes }) => ({
      sid: sessionId,
      pid,
      processes,
    }));
    this.#port.postMessage({ t: 'processes', sessions } satisfies PtyHostMessage);
  }

  detached(sessionId: SessionId): void {
    this.#port.postMessage({ t: 'detached', sid: sessionId } satisfies PtyHostMessage);
  }
}

function dispatch(
  message: PtyClientMessage,
  target: { connection: HostConnection; port: MainMessagePort },
): void {
  const { connection, port } = target;
  if (message.t === 'monitor') {
    connection.monitor(message.on);
    return;
  }
  if (message.t === 'signal') {
    connection.signal(message.pid, message.signal);
    return;
  }
  const sessionId = asSessionId(message.sid);
  switch (message.t) {
    case 'spawn': {
      const result = connection.spawn({
        sessionId,
        size: normalizeTerminalSize(message),
        ...(message.cwd === undefined ? {} : { cwd: message.cwd }),
        ...(message.shell === undefined ? {} : { shell: message.shell }),
      });
      const reply: PtyHostMessage = result.ok
        ? { t: 'spawned', reqId: message.reqId, ...result.value }
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
    case 'detach':
      connection.detach(sessionId);
      return;
    case 'attach': {
      const result = connection.attach(sessionId);
      port.postMessage(
        (result.ok
          ? { t: 'attached', reqId: message.reqId, pid: result.value.pid }
          : {
              t: 'attached',
              reqId: message.reqId,
              message: result.error.message,
            }) satisfies PtyHostMessage,
      );
      return;
    }
    case 'ack':
      connection.acknowledge(sessionId, message.bytes);
      return;
    case 'cwd':
      void connection.cwd(sessionId).then((cwd) => {
        const reply: PtyHostMessage =
          cwd === undefined
            ? { t: 'cwd', reqId: message.reqId }
            : { t: 'cwd', reqId: message.reqId, cwd };
        port.postMessage(reply);
      });
      return;
  }
}

/**
 * Serves one renderer connection over a MessagePort. Disposing (or the renderer
 * going away) closes the connection and kills its sessions. `onClose` hears only of the
 * renderer going away.
 */
export function servePtyConnection(
  port: MainMessagePort,
  host: PtySessionHost,
  onClose?: () => void,
): Disposable {
  const connection = host.openConnection(new PortSessionOutput(port));
  let closed = false;
  const close = toDisposable(() => {
    closed = true;
    host.closeConnection(connection);
    port.close();
  });
  port.on('message', ({ data }) => {
    const message = decodePtyClientMessage(data);
    if (message !== undefined) dispatch(message, { connection, port });
  });
  port.on('close', () => {
    if (closed) return;
    close.dispose();
    onClose?.();
  });
  port.start();
  return close;
}
