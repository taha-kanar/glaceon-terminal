import { asSessionId, type PtyExit, type SessionId } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { FakePtyProcessFactory } from '../testing';
import { PtySessionHost } from './pty-session-host';
import type { SessionOutput } from './session-output';
import type { ShellProfile } from './shell-profile';

const shell: ShellProfile = { file: '/bin/zsh', args: ['-l'], cwd: '/Users/me', env: { A: '1' } };

class RecordingOutput implements SessionOutput {
  readonly chunks: { sessionId: SessionId; text: string }[] = [];
  readonly exits: { sessionId: SessionId; exit: PtyExit }[] = [];

  data(sessionId: SessionId, chunk: Uint8Array): void {
    this.chunks.push({ sessionId, text: new TextDecoder().decode(chunk) });
  }

  exit(sessionId: SessionId, exit: PtyExit): void {
    this.exits.push({ sessionId, exit });
  }
}

function setup() {
  const processes = new FakePtyProcessFactory();
  const host = new PtySessionHost({ processes, shell });
  return { processes, host };
}

const size = { cols: 80, rows: 24 };

describe('PtySessionHost', () => {
  it('spawns the shell profile, using the requested cwd when given', () => {
    const { processes, host } = setup();
    const connection = host.openConnection(new RecordingOutput());

    const first = connection.spawn({ sessionId: asSessionId('a'), size });
    connection.spawn({ sessionId: asSessionId('b'), size, cwd: '/tmp' });

    expect(first).toEqual({ ok: true, value: { pid: 1000 } });
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
