import { err } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { FakePtyPort, FakeTerminalView, SequentialIdGenerator } from '../testing';
import { TerminalSessionService } from './terminal-session-service';

function setup() {
  const pty = new FakePtyPort();
  const view = new FakeTerminalView();
  const service = new TerminalSessionService({ pty, ids: new SequentialIdGenerator('s') });
  return { pty, view, service };
}

describe('TerminalSessionService.open', () => {
  it('spawns with the fitted view size before any resize happens', async () => {
    const { pty, view, service } = setup();
    view.fitSize = { cols: 132, rows: 43 };

    const result = await service.open(view, { cwd: '/tmp' });

    expect(result.ok).toBe(true);
    expect(pty.spawned).toEqual([{ sessionId: 's-1', size: { cols: 132, rows: 43 }, cwd: '/tmp' }]);
  });

  it('normalizes a degenerate fitted size', async () => {
    const { pty, view, service } = setup();
    view.fitSize = { cols: 0, rows: Number.NaN };

    await service.open(view);

    expect(pty.spawned[0]?.size).toEqual({ cols: 1, rows: 1 });
  });

  it('pipes output to the view, input to the pty and resizes to the pty', async () => {
    const { pty, view, service } = setup();
    const result = await service.open(view);
    if (!result.ok) throw new Error('expected session');
    const sessionId = result.value.id;

    pty.emitData(sessionId, 'hello');
    view.input.emit('ls\r');
    view.resize.emit({ cols: 90, rows: 20 });

    expect(view.text).toBe('hello');
    expect(pty.writes).toEqual([{ sessionId, data: 'ls\r' }]);
    expect(pty.resizes).toEqual([{ sessionId, size: { cols: 90, rows: 20 } }]);
  });

  it('returns the spawn error and leaves no listeners behind', async () => {
    const { pty, view, service } = setup();
    pty.nextSpawnResult = err({ message: 'boom' });

    const result = await service.open(view);

    expect(result).toEqual({ ok: false, error: { message: 'boom' } });
    expect(pty.listenerCount(pty.spawned[0]!.sessionId)).toBe(0);
    expect(view.input.size).toBe(0);
  });

  it('closing the session kills the pty and stops forwarding', async () => {
    const { pty, view, service } = setup();
    const result = await service.open(view);
    if (!result.ok) throw new Error('expected session');

    result.value.close();
    result.value.close();
    view.input.emit('ignored');

    expect(pty.killed).toEqual([result.value.id]);
    expect(pty.writes).toEqual([]);
    expect(result.value.isClosed).toBe(true);
  });

  it('stops forwarding once the shell exits', async () => {
    const { pty, view, service } = setup();
    const result = await service.open(view);
    if (!result.ok) throw new Error('expected session');

    pty.emitExit(result.value.id, { exitCode: 0 });
    view.input.emit('ignored');

    expect(pty.writes).toEqual([]);
    expect(pty.listenerCount(result.value.id)).toBe(0);
  });
});
