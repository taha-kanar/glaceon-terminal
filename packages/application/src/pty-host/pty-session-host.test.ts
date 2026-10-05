import { asSessionId, type ProcessSample, type PtyExit, type SessionId } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import {
  FakeProcessInspector,
  FakeProcessSignaller,
  FakeProcessTable,
  FakePtyProcessFactory,
  ManualScheduler,
} from '../testing';
import type { ForegroundProcess } from '../terminal/pty-port';
import { PtySessionHost } from './pty-session-host';
import type { SessionOutput, SessionProcesses } from './session-output';
import type { ShellProfile } from './shell-profile';

const shell: ShellProfile = { file: '/bin/zsh', args: ['-l'], cwd: '/Users/me', env: { A: '1' } };

class RecordingOutput implements SessionOutput {
  readonly chunks: { sessionId: SessionId; text: string }[] = [];
  readonly exits: { sessionId: SessionId; exit: PtyExit }[] = [];
  readonly foreground: { sessionId: SessionId; name: string; busy: boolean }[] = [];

  data(sessionId: SessionId, chunk: Uint8Array): void {
    this.chunks.push({ sessionId, text: new TextDecoder().decode(chunk) });
    this.log.push(`data:${new TextDecoder().decode(chunk)}`);
  }

  exit(sessionId: SessionId, exit: PtyExit): void {
    this.exits.push({ sessionId, exit });
  }

  process(sessionId: SessionId, process: ForegroundProcess): void {
    this.foreground.push({ sessionId, ...process });
  }

  readonly reports: (readonly SessionProcesses[])[] = [];

  processes(reports: readonly SessionProcesses[]): void {
    this.reports.push(reports);
  }

  readonly log: string[] = [];

  detached(sessionId: SessionId): void {
    this.log.push(`detached:${sessionId}`);
  }
}

function setup() {
  const processes = new FakePtyProcessFactory();
  const scheduler = new ManualScheduler();
  const inspector = new FakeProcessInspector();
  const table = new FakeProcessTable();
  const signaller = new FakeProcessSignaller();
  let now = 0;
  const host = new PtySessionHost({
    processes,
    shell,
    scheduler,
    inspector,
    table,
    signaller,
    now: () => now,
    flow: { batch: { delayMs: 5, maxBytes: 8 }, watermarks: { high: 10, low: 4 } },
  });
  const clock = {
    advance: async (ms: number) => {
      now += ms;
      scheduler.advance(ms);
      await Promise.resolve();
      await Promise.resolve();
    },
  };
  return { processes, host, scheduler, inspector, table, signaller, clock };
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

  it('starts the requested shell as a login shell instead of the default', () => {
    const { processes, host } = setup();
    const connection = host.openConnection(new RecordingOutput());
    const spawned = connection.spawn({ sessionId: asSessionId('a'), size, shell: '/bin/bash' });
    expect(spawned).toEqual({ ok: true, value: { pid: 1000, shell: 'bash' } });
    expect(processes.processes[0]?.options).toMatchObject({ file: '/bin/bash', args: ['-l'] });
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
    expect(output.foreground).toEqual([{ sessionId: 'a', name: 'bash', busy: false }]);

    target.foregroundProcess = 'vim';
    connection.write(asSessionId('a'), 'vim\r');
    scheduler.advance(150);
    await settle();
    expect(output.foreground.at(-1)).toEqual({ sessionId: 'a', name: 'vim', busy: true });

    target.foregroundProcess = 'bash';
    scheduler.advance(1000);
    await settle();
    expect(output.foreground.map((p) => p.busy)).toEqual([false, true, false]);
  });

  it('does not keep the name a shell had before it exec-ed into another one', async () => {
    const { processes, host, scheduler, inspector } = setup();
    const output = new RecordingOutput();
    host.openConnection(output).spawn({ sessionId: asSessionId('a'), size });
    const target = processes.processes[0]!;
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    inspector.names.set(1000, 'sh');
    target.foregroundProcess = 'sh';
    scheduler.advance(1000);
    await settle();
    // macOS /bin/sh execs bash under the same pid.
    inspector.names.set(1000, 'bash');
    target.foregroundProcess = 'bash';
    scheduler.advance(1000);
    await settle();
    expect(output.foreground.map(({ name, busy }) => [name, busy])).toEqual([
      ['sh', false],
      ['bash', false],
    ]);
  });

  it('looks again when the foreground changes while the shell name is looked up', async () => {
    const { processes, host, scheduler, inspector } = setup();
    const output = new RecordingOutput();
    host.openConnection(output).spawn({ sessionId: asSessionId('a'), size });
    const target = processes.processes[0]!;
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    target.foregroundProcess = 'sh';
    inspector.names.set(1000, 'bash');
    scheduler.advance(1000);
    target.foregroundProcess = 'bash';
    await settle();
    expect(output.foreground.map(({ name, busy }) => [name, busy])).toEqual([['bash', false]]);
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
    expect(output.foreground.map(({ name, busy }) => [name, busy])).toEqual([
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

const row = (pid: number, ppid: number, extra: Partial<ProcessSample> = {}): ProcessSample => ({
  pid,
  ppid,
  pgid: pid,
  tpgid: 0,
  tty: 'ttys001',
  stat: 'S',
  cpuTimeMs: 0,
  memoryKb: 1000,
  args: `/bin/p${String(pid)}`,
  ...extra,
});

describe('process monitoring', () => {
  it('polls only while a connection monitors and reports each session tree', async () => {
    const { host, table, clock } = setup();
    const output = new RecordingOutput();
    const connection = host.openConnection(output);
    connection.spawn({ sessionId: asSessionId('a'), size });
    table.rows = [row(1000, 1), row(1001, 1000, { pgid: 1001, tpgid: 1001 }), row(77, 1)];

    await clock.advance(5000);
    expect(table.calls).toBe(0);

    connection.monitor(true);
    await clock.advance(0);
    expect(output.reports.at(-1)?.[0]?.processes.map((p) => p.pid)).toEqual([1000, 1001]);
    expect(output.reports.at(-1)?.[0]?.processes[1]).toMatchObject({
      name: 'p1001',
      foreground: true,
    });

    table.rows = [row(1000, 1), row(1001, 1000, { cpuTimeMs: 750 })];
    await clock.advance(1500);
    expect(output.reports.at(-1)?.[0]?.processes[1]?.cpu).toBeCloseTo(50);

    connection.monitor(false);
    const calls = table.calls;
    await clock.advance(10_000);
    expect(table.calls).toBe(calls);
  });

  it('signals only processes in its own sessions', async () => {
    const { host, table, signaller, clock } = setup();
    const connection = host.openConnection(new RecordingOutput());
    connection.spawn({ sessionId: asSessionId('a'), size });
    table.rows = [row(1000, 1), row(1001, 1000), row(77, 1)];
    expect(connection.signal(1001, 'SIGINT')).toBe(false);
    connection.monitor(true);
    await clock.advance(0);
    expect(connection.signal(1001, 'SIGINT')).toBe(true);
    expect(connection.signal(77, 'SIGKILL')).toBe(false);
    expect(signaller.sent).toEqual([{ pid: 1001, signal: 'SIGINT' }]);
    host.closeConnection(connection);
  });

  it('skips failed samples', async () => {
    const { host, table, clock } = setup();
    const output = new RecordingOutput();
    const connection = host.openConnection(output);
    table.failing = true;
    connection.monitor(true);
    await clock.advance(1500);
    expect(output.reports).toEqual([]);
  });
});

describe('moving sessions between connections', () => {
  const encode = (text: string) => new TextEncoder().encode(text);

  it('delivers earlier output, buffers while detached and replays to the new owner', () => {
    const { host, processes, scheduler } = setup();
    const a = new RecordingOutput();
    const b = new RecordingOutput();
    const source = host.openConnection(a);
    const target = host.openConnection(b);
    const sid = asSessionId('s');
    source.spawn({ sessionId: sid, size });
    const pty = processes.processes[0];

    pty?.data.emit(encode('one'));
    expect(source.detach(sid)).toBe(true);
    expect(a.log).toEqual(['data:one', 'detached:s']);
    pty?.data.emit(encode('two'));
    scheduler.advance(10);
    source.write(sid, 'ignored');
    expect(pty?.writes).toEqual([]);

    expect(target.attach(sid)).toEqual({ ok: true, value: { pid: 1000 } });
    pty?.data.emit(encode('three'));
    scheduler.advance(10);
    expect(b.chunks.map((c) => c.text)).toEqual(['two', 'three']);
    target.write(sid, 'ls');
    expect(pty?.writes).toEqual(['ls']);
    expect(a.chunks.map((c) => c.text)).toEqual(['one']);
    expect(source.detach(sid)).toBe(false);
  });

  it('refuses unknown sessions and reports exits that happened while detached', () => {
    const { host, processes } = setup();
    const b = new RecordingOutput();
    const source = host.openConnection(new RecordingOutput());
    const target = host.openConnection(b);
    expect(target.attach(asSessionId('nope')).ok).toBe(false);
    source.spawn({ sessionId: asSessionId('s'), size });
    source.detach(asSessionId('s'));
    processes.processes[0]?.exit.emit({ exitCode: 4 });
    target.attach(asSessionId('s'));
    expect(b.exits).toEqual([{ sessionId: 's', exit: { exitCode: 4 } }]);
    expect(host.sessionCount).toBe(0);
  });

  it('kills sessions nobody claims and survives the source closing', () => {
    const { host, processes, scheduler } = setup();
    const source = host.openConnection(new RecordingOutput());
    source.spawn({ sessionId: asSessionId('s'), size });
    source.spawn({ sessionId: asSessionId('t'), size });
    source.detach(asSessionId('s'));
    host.closeConnection(source);
    expect(processes.processes.map((p) => p.killed)).toEqual([false, true]);
    scheduler.advance(30_000);
    expect(processes.processes[0]?.killed).toBe(true);
  });

  it('un-pauses a session whose old owner never acknowledged its output', () => {
    const { host, processes, scheduler } = setup();
    const source = host.openConnection(new RecordingOutput());
    const target = host.openConnection(new RecordingOutput());
    source.spawn({ sessionId: asSessionId('s'), size });
    const pty = processes.processes[0];
    pty?.data.emit(encode('0123456789ab'));
    scheduler.advance(10);
    expect(pty?.paused).toBe(true);
    source.detach(asSessionId('s'));
    target.attach(asSessionId('s'));
    expect(pty?.paused).toBe(false);
  });
});
