import type {
  ForegroundProcess,
  ProcessMonitorPort,
  PtyError,
  PtyPort,
  ShellProcesses,
  SpawnedSession,
  SpawnRequest,
} from '@glaceon/application';
import {
  decodePtyHostMessage,
  type PtyClientMessage,
  type PtyHostMessage,
} from '@glaceon/contracts';
import {
  Emitter,
  err,
  KeyedEmitter,
  toDisposable,
  type ProcessSignal,
  ok,
  type Disposable,
  type PtyExit,
  type Result,
  type SessionId,
  type TerminalSize,
} from '@glaceon/domain';

type SpawnReply = (result: Result<SpawnedSession, PtyError>) => void;
type CwdReply = (cwd: string | undefined) => void;
type AttachReply = (result: Result<{ readonly pid: number }, PtyError>) => void;

/** The host is told about rendered bytes in steps of this size to keep ack traffic low. */
export const ACK_STEP_BYTES = 5_000;

/** PtyPort over a MessagePort connected straight to the pty host. */
export class MessagePortPtyClient implements PtyPort, ProcessMonitorPort {
  readonly #port: MessagePort;
  readonly #pendingSpawns = new Map<number, SpawnReply>();
  readonly #pendingCwds = new Map<number, CwdReply>();
  readonly #pendingAttaches = new Map<number, AttachReply>();
  readonly #pendingDetaches = new Map<string, () => void>();
  readonly #unacknowledged = new Map<string, number>();
  readonly #data = new KeyedEmitter<string, Uint8Array>();
  readonly #exit = new KeyedEmitter<string, PtyExit>();
  readonly #process = new KeyedEmitter<string, ForegroundProcess>();
  readonly #processTrees = new Emitter<readonly ShellProcesses[]>();
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

  acknowledge(sessionId: SessionId, bytes: number): void {
    const total = (this.#unacknowledged.get(sessionId) ?? 0) + bytes;
    if (total < ACK_STEP_BYTES) {
      this.#unacknowledged.set(sessionId, total);
      return;
    }
    this.#unacknowledged.set(sessionId, 0);
    this.#send({ t: 'ack', sid: sessionId, bytes: total });
  }

  cwd(sessionId: SessionId): Promise<string | undefined> {
    const reqId = this.#nextRequestId++;
    return new Promise((resolve) => {
      this.#pendingCwds.set(reqId, resolve);
      this.#send({ t: 'cwd', reqId, sid: sessionId });
    });
  }

  onData(sessionId: SessionId, listener: (chunk: Uint8Array) => void): Disposable {
    return this.#data.on(sessionId, listener);
  }

  onExit(sessionId: SessionId, listener: (exit: PtyExit) => void): Disposable {
    return this.#exit.on(sessionId, listener);
  }

  onProcess(sessionId: SessionId, listener: (process: ForegroundProcess) => void): Disposable {
    return this.#process.on(sessionId, listener);
  }

  detach(sessionId: SessionId): Promise<void> {
    return new Promise((resolve) => {
      this.#pendingDetaches.set(sessionId, resolve);
      this.#send({ t: 'detach', sid: sessionId });
    });
  }

  attach(sessionId: SessionId): Promise<Result<{ readonly pid: number }, PtyError>> {
    const reqId = this.#nextRequestId++;
    return new Promise((resolve) => {
      this.#pendingAttaches.set(reqId, resolve);
      this.#send({ t: 'attach', reqId, sid: sessionId });
    });
  }

  watchProcesses(listener: (shells: readonly ShellProcesses[]) => void): Disposable {
    const subscription = this.#processTrees.on(listener);
    if (this.#processTrees.size === 1) this.#send({ t: 'monitor', on: true });
    return toDisposable(() => {
      subscription.dispose();
      if (this.#processTrees.size === 0) this.#send({ t: 'monitor', on: false });
    });
  }

  signal(pid: number, signal: ProcessSignal): void {
    this.#send({ t: 'signal', pid, signal });
  }

  #send(message: PtyClientMessage): void {
    this.#port.postMessage(message);
  }

  #receive(message: PtyHostMessage): void {
    switch (message.t) {
      case 'data':
        this.#data.emit(message.sid, message.chunk);
        return;
      case 'process':
        this.#process.emit(message.sid, { name: message.name, busy: message.busy });
        return;
      case 'exit':
        this.#exit.emit(
          message.sid,
          message.signal === undefined
            ? { exitCode: message.exitCode }
            : { exitCode: message.exitCode, signal: message.signal },
        );
        this.#forget(message.sid);
        return;
      case 'spawned':
        this.#settleSpawn(message.reqId, ok({ pid: message.pid, shell: message.shell }));
        return;
      case 'spawnFailed':
        this.#settleSpawn(message.reqId, err({ message: message.message }));
        return;
      case 'detached': {
        // Everything sent before this message has been emitted to `onData` listeners.
        const resolve = this.#pendingDetaches.get(message.sid);
        this.#pendingDetaches.delete(message.sid);
        this.#forget(message.sid);
        resolve?.();
        return;
      }
      case 'attached': {
        const reply = this.#pendingAttaches.get(message.reqId);
        this.#pendingAttaches.delete(message.reqId);
        reply?.(
          message.pid === undefined
            ? err({ message: message.message ?? 'Cannot attach the session' })
            : ok({ pid: message.pid }),
        );
        return;
      }
      case 'processes':
        this.#processTrees.emit(
          message.sessions.map(({ pid, processes }) => ({ shellPid: pid, processes })),
        );
        return;
      case 'cwd': {
        const reply = this.#pendingCwds.get(message.reqId);
        this.#pendingCwds.delete(message.reqId);
        reply?.(message.cwd);
        return;
      }
    }
  }

  #forget(sessionId: string): void {
    this.#data.delete(sessionId);
    this.#exit.delete(sessionId);
    this.#process.delete(sessionId);
    this.#unacknowledged.delete(sessionId);
  }

  #settleSpawn(reqId: number, result: Result<SpawnedSession, PtyError>): void {
    const reply = this.#pendingSpawns.get(reqId);
    this.#pendingSpawns.delete(reqId);
    reply?.(result);
  }
}
