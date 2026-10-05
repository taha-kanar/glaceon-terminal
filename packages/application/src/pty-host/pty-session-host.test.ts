import { asSessionId, type PtyExit, type SessionId } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { FakeProcessInspector, FakePtyProcessFactory, ManualScheduler } from '../testing';
import type { ForegroundProcess } from '../terminal/pty-port';
import { PtySessionHost } from './pty-session-host';
import type { SessionOutput } from './session-output';
import type { ShellProfile } from './shell-profile';

const shell: ShellProfile = { file: '/bin/zsh', args: ['-l'], cwd: '/Users/me', env: { A: '1' } };

class RecordingOutput implements SessionOutput {
  readonly chunks: { sessionId: SessionId; text: string }[] = [];
  readonly exits: { sessionId: SessionId; exit: PtyExit }[] = [];
  readonly processes: { sessionId: SessionId; name: string; busy: boolean }[] = [];

  data(sessionId: SessionId, chunk: Uint8Array): void {
    this.chunks.push({ sessionId, text: new TextDecoder().decode(chunk) });
  }

  exit(sessionId: SessionId, exit: PtyExit): void {
    this.exits.push({ sessionId, exit });
  }

  process(sessionId: SessionId, process: ForegroundProcess): void {
    this.processes.push({ sessionId, ...process });
  }
}

function setup() {
  const processes = new FakePtyProcessFactory();
  const scheduler = new ManualScheduler();
  const inspector = new FakeProcessInspector();
  const host = new PtySessionHost({
    processes,
    shell,
    scheduler,
    inspector,
    flow: { batch: { delayMs: 5, maxBytes: 8 }, watermarks: { high: 10, low: 4 } },
  });
  return { processes, host, scheduler, inspector };
}

const size = { cols: 80, rows: 24 };

describe('PtySessionHost', () => {
  it('spawns the shell profile, using the requested cwd when given', () => {
    const { processes, host } = setup();
    const connection = host.openConnection(new RecordingOutput());

    const first = connection.spawn({ sessionId: asSessionId('a'), size });
    connection.spawn({ sessionId: asSessionId('b'), size, cwd: '/tmp' });

    expect(first).toEqual({ ok: true, value: { pid: 1000, shell: 'zsh' } });
    expect(processes.processes.map((p) => p.options.cwd)).toEqual(['/Users/me', '/tmp']);
    expect(processes.processes[0]?.options).toMatchObject({ file: '/bin/zsh', args: ['-l'], size });
    expect(host.sessionCount).toBe(2);
  });

  it('routes output and exit to the owning connection only', () => {
    const { processes, host } = setup();
    const outputA = new RecordingOutput();
    const outputB = new RecordingOutput();
    host.openConnection(outputA).spawn({ sessionId: asSessionId('a'), size });
    host.openConnection(outputB);

    processes.processes[0]?.data.emit(new TextEncoder().encode('hi'));
    processes.processes[0]?.exit.emit({ exitCode: 3 });

    expect(outputA.chunks).toEqual([{ sessionId: 'a', text: 'hi' }]);
    expect(outputA.exits).toEqual([{ sessionId: 'a', exit: { exitCode: 3 } }]);
    expect(outputB.chunks).toEqual([]);
    expect(host.sessionCount).toBe(0);
  });

  it('rejects duplicate session ids across connections', () => {
    const { host } = setup();
    host.openConnection(new RecordingOutput()).spawn({ sessionId: asSessionId('a'), size });

    const result = host
      .openConnection(new RecordingOutput())
      .spawn({ sessionId: asSessionId('a'), size });

    expect(result.ok).toBe(false);
  });

  it('reports spawn failures as errors', () => {
    const { processes, host } = setup();
    processes.failWith = new Error('posix_spawnp failed');

    const result = host
      .openConnection(new RecordingOutput())
      .spawn({ sessionId: asSessionId('a'), size });

    expect(result).toEqual({ ok: false, error: { message: 'posix_spawnp failed' } });
  });

  it('ignores commands for sessions owned by another connection', () => {
    const { processes, host } = setup();
    host.openConnection(new RecordingOutput()).spawn({ sessionId: asSessionId('a'), size });
    const intruder = host.openConnection(new RecordingOutput());

    intruder.write(asSessionId('a'), 'rm -rf ~\r');
    intruder.resize(asSessionId('a'), { cols: 1, rows: 1 });
    intruder.kill(asSessionId('a'));

    const target = processes.processes[0];
    expect(target?.writes).toEqual([]);
    expect(target?.resizes).toEqual([]);
    expect(target?.killed).toBe(false);
  });

  it('forwards commands to owned sessions', () => {
    const { processes, host } = setup();
    const connection = host.openConnection(new RecordingOutput());
    connection.spawn({ sessionId: asSessionId('a'), size });

    connection.write(asSessionId('a'), 'ls\r');
    connection.resize(asSessionId('a'), { cols: 100, rows: 30 });
    connection.kill(asSessionId('a'));

    const target = processes.processes[0];
    expect(target?.writes).toEqual(['ls\r']);
    expect(target?.resizes).toEqual([{ cols: 100, rows: 30 }]);
    expect(target?.killed).toBe(true);
  });

  it('closing a connection kills its sessions and refuses new ones', () => {
    const { processes, host } = setup();
    const connection = host.openConnection(new RecordingOutput());
    connection.spawn({ sessionId: asSessionId('a'), size });
    const other = host.openConnection(new RecordingOutput());
    other.spawn({ sessionId: asSessionId('b'), size });

    host.closeConnection(connection);

    expect(processes.processes.map((p) => p.killed)).toEqual([true, false]);
    expect(connection.spawn({ sessionId: asSessionId('c'), size }).ok).toBe(false);
  });

  it('dispose kills every session', () => {
    const { processes, host } = setup();
    host.openConnection(new RecordingOutput()).spawn({ sessionId: asSessionId('a'), size });
    host.openConnection(new RecordingOutput()).spawn({ sessionId: asSessionId('b'), size });

    host.dispose();

    expect(processes.processes.every((p) => p.killed)).toBe(true);
  });
});

const bytes = (text: string) => new TextEncoder().encode(text);

describe('HostConnection output', () => {
  it('batches small reads until the delay passes and flushes before the exit', () => {
    const { processes, host, scheduler } = setup();
    const output = new RecordingOutput();
    host.openConnection(output).spawn({ sessionId: asSessionId('a'), size });
    const target = processes.processes[0]!;

    target.data.emit(bytes('ab'));
    target.data.emit(bytes('c'));
    expect(output.chunks).toEqual([]);
    scheduler.advance(5);
    expect(output.chunks).toEqual([{ sessionId: 'a', text: 'abc' }]);

    target.data.emit(bytes('d'));
    target.exit.emit({ exitCode: 0 });
    expect(output.chunks.map((c) => c.text)).toEqual(['abc', 'd']);
    expect(output.exits).toHaveLength(1);
  });

  it('flushes immediately when the batch is full', () => {
    const { processes, host } = setup();
    const output = new RecordingOutput();
    host.openConnection(output).spawn({ sessionId: asSessionId('a'), size });

    processes.processes[0]!.data.emit(bytes('123456789'));

    expect(output.chunks.map((c) => c.text)).toEqual(['123456789']);
  });

  it('pauses the pty above the high watermark and resumes below the low one', () => {
    const { processes, host } = setup();
    const connection = host.openConnection(new RecordingOutput());
    connection.spawn({ sessionId: asSessionId('a'), size });
    const target = processes.processes[0]!;

    target.data.emit(bytes('123456789'));
    expect(target.paused).toBe(false);
    target.data.emit(bytes('123456789'));
    expect(target.paused).toBe(true);

    connection.acknowledge(asSessionId('a'), 9);
    expect(target.paused).toBe(true);
    connection.acknowledge(asSessionId('a'), 6);
    expect(target.paused).toBe(false);
  });

  it('reports foreground changes on the poll and after Enter, busy unless it is the shell', async () => {
    const { processes, host, scheduler, inspector } = setup();
    const output = new RecordingOutput();
    const connection = host.openConnection(output);
    connection.spawn({ sessionId: asSessionId('a'), size });
    const target = processes.processes[0]!;
    inspector.names.set(1000, 'bash');
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    target.foregroundProcess = 'bash';
    scheduler.advance(1000);
    await settle();
    expect(output.processes).toEqual([{ sessionId: 'a', name: 'bash', busy: false }]);

    target.foregroundProcess = 'vim';
    connection.write(asSessionId('a'), 'vim\r');
    scheduler.advance(150);
    await settle();
    expect(output.processes.at(-1)).toEqual({ sessionId: 'a', name: 'vim', busy: true });

    target.foregroundProcess = 'bash';
    scheduler.advance(1000);
    await settle();
    expect(output.processes.map((p) => p.busy)).toEqual([false, true, false]);
  });

  it('falls back to the shell file name when the shell process cannot be inspected', async () => {
    const { processes, host, scheduler } = setup();
    const output = new RecordingOutput();
    host.openConnection(output).spawn({ sessionId: asSessionId('a'), size });
    const target = processes.processes[0]!;
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    target.foregroundProcess = 'top';
    scheduler.advance(1000);
    await settle();
    target.foregroundProcess = 'zsh';
    scheduler.advance(1000);
    await settle();
    expect(output.processes.map(({ name, busy }) => [name, busy])).toEqual([
      ['top', true],
      ['zsh', false],
    ]);
  });

  it('resolves the working directory of owned sessions only', async () => {
    const { host, inspector } = setup();
    const connection = host.openConnection(new RecordingOutput());
    connection.spawn({ sessionId: asSessionId('a'), size });
    inspector.cwds.set(1000, '/projects/glaceon');

    expect(await connection.cwd(asSessionId('a'))).toBe('/projects/glaceon');
    expect(await host.openConnection(new RecordingOutput()).cwd(asSessionId('a'))).toBeUndefined();
  });

  it('stops polling once closed', () => {
    const { host, scheduler } = setup();
    const connection = host.openConnection(new RecordingOutput());
    expect(scheduler.pending).toBe(1);
    host.closeConnection(connection);
    expect(scheduler.pending).toBe(0);
  });
});
