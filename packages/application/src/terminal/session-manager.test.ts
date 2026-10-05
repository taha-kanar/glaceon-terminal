import { asPaneId, err, ok } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { FakePtyPort, FakeTerminalView, SequentialIdGenerator } from '../testing';
import { SessionManager } from './session-manager';
import { TerminalSessionService } from './terminal-session-service';

const pane = asPaneId('p1');

function setup() {
  const pty = new FakePtyPort();
  const manager = new SessionManager(
    new TerminalSessionService({ pty, ids: new SequentialIdGenerator('s') }),
  );
  const view = new FakeTerminalView();
  return { pty, manager, view };
}

describe('SessionManager', () => {
  it('opens a shell with prepared options and tracks its info', async () => {
    const { pty, manager, view } = setup();
    manager.prepare(pane, { cwd: '/src' });
    await manager.open(pane, view);
    expect(pty.spawned[0]?.cwd).toBe('/src');
    expect(manager.info.get().get(pane)).toEqual({ pid: 4242, shell: 'zsh', process: 'zsh' });
    expect(manager.has(pane)).toBe(true);
    await manager.open(pane, view);
    expect(pty.spawned).toHaveLength(1);
  });

  it('knows when a pane is busy', async () => {
    const { pty, manager, view } = setup();
    await manager.open(pane, view);
    expect(manager.isBusy(pane)).toBe(false);
    pty.emitProcess(pty.spawned[0]!.sessionId, 'vim');
    expect(manager.isBusy(pane)).toBe(true);
    expect(manager.isBusy(asPaneId('other'))).toBe(false);
  });

  it('marks exits, emits them and restarts on Enter', async () => {
    const { pty, manager, view } = setup();
    const exits: number[] = [];
    manager.onDidExit(({ exit }) => exits.push(exit.exitCode));
    await manager.open(pane, view);
    pty.emitExit(pty.spawned[0]!.sessionId, { exitCode: 1 });
    expect(exits).toEqual([1]);
    expect(manager.info.get().get(pane)?.exit).toEqual({ exitCode: 1 });
    expect(manager.isBusy(pane)).toBe(false);

    view.input.emit('x');
    expect(pty.spawned).toHaveLength(1);
    view.input.emit('\r');
    await Promise.resolve();
    await Promise.resolve();
    expect(pty.spawned).toHaveLength(2);
    expect(manager.info.get().get(pane)?.exit).toBeUndefined();
  });

  it('records spawn failures as an exited pane with an error', async () => {
    const { pty, manager, view } = setup();
    pty.nextSpawnResult = err({ message: 'no shell' });
    await manager.open(pane, view);
    expect(manager.info.get().get(pane)).toEqual({ error: 'no shell', exit: { exitCode: -1 } });
    pty.nextSpawnResult = ok({ pid: 7, shell: 'zsh' });
    await manager.restart(pane);
    expect(manager.info.get().get(pane)?.pid).toBe(7);
  });

  it('releasing kills the shell, even when it is still starting', async () => {
    const { pty, manager, view } = setup();
    await manager.open(pane, view);
    manager.release(pane);
    expect(pty.killed).toEqual([pty.spawned[0]!.sessionId]);
    expect(manager.info.get().has(pane)).toBe(false);

    const starting = manager.open(asPaneId('p2'), new FakeTerminalView());
    manager.release(asPaneId('p2'));
    await starting;
    expect(pty.killed).toHaveLength(2);
  });

  it('focuses, clears and resolves cwd; focus requested early is applied after start', async () => {
    const { manager, view } = setup();
    manager.focus(pane);
    expect(await manager.cwdOf(pane)).toBeUndefined();
    await manager.open(pane, view);
    expect(view.focused).toBe(true);
    manager.clear(pane);
    expect(view.cleared).toBe(1);
    expect(await manager.cwdOf(pane)).toBe('/work');
  });
});
