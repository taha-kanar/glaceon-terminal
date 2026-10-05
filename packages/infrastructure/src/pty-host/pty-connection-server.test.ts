import { PtySessionHost } from '@glaceon/application';
import {
  FakeProcessInspector,
  FakePtyProcessFactory,
  ManualScheduler,
} from '@glaceon/application/testing';
import type { PtyHostMessage } from '@glaceon/contracts';
import { describe, expect, it } from 'vitest';
import type { MainMessagePort } from './main-message-port';
import { servePtyConnection } from './pty-connection-server';

class FakeMainPort implements MainMessagePort {
  readonly sent: PtyHostMessage[] = [];
  started = false;
  closed = false;
  #onMessage: ((event: { data: unknown }) => void) | undefined;
  #onClose: (() => void) | undefined;

  postMessage(message: unknown): void {
    this.sent.push(message as PtyHostMessage);
  }

  start(): void {
    this.started = true;
  }

  close(): void {
    this.closed = true;
  }

  on(
    event: 'message' | 'close',
    listener: ((event: { data: unknown }) => void) | (() => void),
  ): this {
    if (event === 'message') this.#onMessage = listener;
    else this.#onClose = listener as () => void;
    return this;
  }

  receive(data: unknown): void {
    this.#onMessage?.({ data });
  }

  remoteClose(): void {
    this.#onClose?.();
  }
}

function setup() {
  const processes = new FakePtyProcessFactory();
  const inspector = new FakeProcessInspector();
  const scheduler = new ManualScheduler();
  const host = new PtySessionHost({
    processes,
    shell: { file: '/bin/zsh', args: ['-l'], cwd: '/home', env: {} },
    scheduler,
    inspector,
  });
  const port = new FakeMainPort();
  const connection = servePtyConnection(port, host);
  return { processes, host, port, connection, inspector, scheduler };
}

describe('servePtyConnection', () => {
  it('starts the port and answers spawn requests', () => {
    const { port, processes } = setup();

    port.receive({ t: 'spawn', reqId: 7, sid: 'a', cols: 0, rows: 30.5 });

    expect(port.started).toBe(true);
    expect(port.sent).toEqual([{ t: 'spawned', reqId: 7, pid: 1000, shell: 'zsh' }]);
    expect(processes.processes[0]?.options.size).toEqual({ cols: 1, rows: 30 });
  });

  it('reports spawn failures with the request id', () => {
    const { port, processes } = setup();
    processes.failWith = new Error('nope');

    port.receive({ t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24 });

    expect(port.sent).toEqual([{ t: 'spawnFailed', reqId: 1, message: 'nope' }]);
  });

  it('forwards input, resize and kill, and streams output back', () => {
    const { port, processes } = setup();
    port.receive({ t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24 });
    const pty = processes.processes[0];

    port.receive({ t: 'input', sid: 'a', data: 'ls\r' });
    port.receive({ t: 'resize', sid: 'a', cols: 100, rows: 40 });
    pty?.data.emit(new Uint8Array([104, 105]));
    pty?.exit.emit({ exitCode: 0 });
    port.receive({ t: 'kill', sid: 'a' });

    expect(pty?.writes).toEqual(['ls\r']);
    expect(pty?.resizes).toEqual([{ cols: 100, rows: 40 }]);
    expect(port.sent.slice(1)).toEqual([
      { t: 'data', sid: 'a', chunk: new Uint8Array([104, 105]) },
      { t: 'exit', sid: 'a', exitCode: 0 },
    ]);
  });

  it('answers cwd requests, applies acks and reports foreground changes', async () => {
    const { port, processes, inspector, scheduler } = setup();
    port.receive({ t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24 });
    inspector.cwds.set(1000, '/src');

    port.receive({ t: 'cwd', reqId: 2, sid: 'a' });
    port.receive({ t: 'cwd', reqId: 3, sid: 'zz' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Replies may arrive in any order; the client matches them by request id.
    expect(port.sent.slice(1)).toHaveLength(2);
    expect(port.sent).toContainEqual({ t: 'cwd', reqId: 2, cwd: '/src' });
    expect(port.sent).toContainEqual({ t: 'cwd', reqId: 3 });

    processes.processes[0]!.foregroundProcess = 'htop';
    scheduler.advance(1000);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(port.sent.at(-1)).toEqual({ t: 'process', sid: 'a', name: 'htop', busy: true });

    port.receive({ t: 'ack', sid: 'a', bytes: 10 });
  });

  it('drops malformed messages', () => {
    const { port, processes } = setup();

    port.receive({ t: 'spawn', sid: 'a' });
    port.receive('garbage');

    expect(processes.processes).toHaveLength(0);
    expect(port.sent).toEqual([]);
  });

  it('kills the sessions when the renderer side closes', () => {
    const { port, processes, host } = setup();
    port.receive({ t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24 });

    port.remoteClose();

    expect(processes.processes[0]?.killed).toBe(true);
    expect(port.closed).toBe(true);
    expect(host.sessionCount).toBe(1); // removed once the process actually exits
  });

  it('kills the sessions when disposed by main', () => {
    const { port, processes, connection } = setup();
    port.receive({ t: 'spawn', reqId: 1, sid: 'a', cols: 80, rows: 24 });

    connection.dispose();

    expect(processes.processes[0]?.killed).toBe(true);
  });
});
