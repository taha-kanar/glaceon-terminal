import type { PtyError, PtyPort, SpawnedSession, SpawnRequest } from '@glaceon/application';
import {
  decodePtyHostMessage,
  type PtyClientMessage,
  type PtyHostMessage,
} from '@glaceon/contracts';
import {
  err,
  KeyedEmitter,
  ok,
  type Disposable,
  type PtyExit,
  type Result,
  type SessionId,
  type TerminalSize,
} from '@glaceon/domain';

type SpawnReply = (result: Result<SpawnedSession, PtyError>) => void;

/** PtyPort over a MessagePort connected straight to the pty host. */
export class MessagePortPtyClient implements PtyPort {
  readonly #port: MessagePort;
  readonly #pendingSpawns = new Map<number, SpawnReply>();
  readonly #data = new KeyedEmitter<string, Uint8Array>();
  readonly #exit = new KeyedEmitter<string, PtyExit>();
  #nextRequestId = 1;

  constructor(port: MessagePort) {
    this.#port = port;
    port.onmessage = (event: MessageEvent<unknown>) => {
      const message = decodePtyHostMessage(event.data);
      if (message !== undefined) this.#receive(message);
    };
  }

  spawn(request: SpawnRequest): Promise<Result<SpawnedSession, PtyError>> {
    const reqId = this.#nextRequestId++;
    return new Promise((resolve) => {
      this.#pendingSpawns.set(reqId, resolve);
      this.#send({
        t: 'spawn',
        reqId,
        sid: request.sessionId,
        cols: request.size.cols,
        rows: request.size.rows,
        ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
      });
    });
  }

  write(sessionId: SessionId, data: string): void {
    this.#send({ t: 'input', sid: sessionId, data });
  }

  resize(sessionId: SessionId, size: TerminalSize): void {
    this.#send({ t: 'resize', sid: sessionId, cols: size.cols, rows: size.rows });
  }

  kill(sessionId: SessionId): void {
    this.#send({ t: 'kill', sid: sessionId });
  }

  onData(sessionId: SessionId, listener: (chunk: Uint8Array) => void): Disposable {
    return this.#data.on(sessionId, listener);
  }

  onExit(sessionId: SessionId, listener: (exit: PtyExit) => void): Disposable {
    return this.#exit.on(sessionId, listener);
  }

  #send(message: PtyClientMessage): void {
    this.#port.postMessage(message);
  }

  #receive(message: PtyHostMessage): void {
    switch (message.t) {
      case 'data':
        this.#data.emit(message.sid, message.chunk);
        return;
      case 'exit':
        this.#exit.emit(
          message.sid,
          message.signal === undefined
            ? { exitCode: message.exitCode }
            : { exitCode: message.exitCode, signal: message.signal },
        );
        this.#data.delete(message.sid);
        this.#exit.delete(message.sid);
        return;
      case 'spawned':
        this.#settleSpawn(message.reqId, ok({ pid: message.pid }));
        return;
      case 'spawnFailed':
        this.#settleSpawn(message.reqId, err({ message: message.message }));
        return;
    }
  }

  #settleSpawn(reqId: number, result: Result<SpawnedSession, PtyError>): void {
    const reply = this.#pendingSpawns.get(reqId);
    this.#pendingSpawns.delete(reqId);
    reply?.(result);
  }
}
