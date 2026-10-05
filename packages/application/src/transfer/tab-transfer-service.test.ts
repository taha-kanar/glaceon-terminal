import {
  activeTab,
  DEFAULT_SETTINGS,
  EMPTY_WORKSPACE,
  leafIds,
  type PaneId,
  type Settings,
  type Workspace,
} from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationService } from '../confirmation/confirmation-service';
import { ObservableStore } from '../store/store';
import { SessionManager } from '../terminal/session-manager';
import { TerminalSessionService } from '../terminal/terminal-session-service';
import { FakePtyPort, FakeTerminalView, FakeWindowPort, SequentialIdGenerator } from '../testing';
import { WorkspaceService } from '../workspace/workspace-service';
import type { TabPayload } from './tab-transfer-port';
import { TabTransferService } from './tab-transfer-service';

function windowWith(pty: FakePtyPort, prefix: string) {
  const ids = new SequentialIdGenerator(prefix);
  const store = new ObservableStore<Workspace>(EMPTY_WORKSPACE);
  const sessions = new SessionManager(new TerminalSessionService({ pty, ids }));
  const window = new FakeWindowPort();
  const workspace = new WorkspaceService({
    store,
    ids,
    sessions,
    confirmation: new ConfirmationService(),
    settings: new ObservableStore<Settings>(DEFAULT_SETTINGS),
    window,
  });
  const views = new Map<PaneId, FakeTerminalView>();
  const notify = vi.fn();
  /** What the UI does for every pane: create a view and open the session. */
  const mount = async () => {
    for (const pane of store.get().tabs.flatMap((tab) => leafIds(tab.root))) {
      if (views.has(pane)) continue;
      const view = new FakeTerminalView();
      views.set(pane, view);
      await sessions.open(pane, view);
    }
  };
  return { store, sessions, workspace, views, notify, mount, window, ids };
}

function transferBetween(
  send: (payload: TabPayload) => Promise<boolean>,
  source: ReturnType<typeof windowWith>,
) {
  return new TabTransferService({
    store: source.store,
    workspace: source.workspace,
    sessions: source.sessions,
    views: { snapshot: (pane) => `[screen of ${pane}]` },
    port: { send },
    ids: source.ids,
    notify: source.notify,
  });
}

describe('TabTransferService', () => {
  it('moves a tab with its running shells and screen to another window', async () => {
    const pty = new FakePtyPort();
    const source = windowWith(pty, 's');
    const target = windowWith(pty, 't');
    source.workspace.ensureTab();
    source.workspace.newTab();
    await source.mount();
    const moving = activeTab(source.store.get());
    const pane = moving?.activePane;
    if (pane === undefined) throw new Error('no pane');

    const receiver = transferBetween(() => Promise.resolve(false), target);
    const sender = transferBetween(async (payload) => {
      const imported = receiver.importTab(payload);
      await target.mount();
      return imported;
    }, source);

    expect(await sender.moveTab(undefined, { kind: 'newWindow' })).toBe(true);
    expect(source.store.get().tabs).toHaveLength(1);
    expect(pty.killed).toEqual([]);
    const arrived = activeTab(target.store.get());
    expect(arrived?.root).toEqual(moving?.root);
    expect(target.views.get(pane)?.text).toBe(`[screen of ${pane}]`);
    expect(target.sessions.info.get().get(pane)).toMatchObject({ pid: 4242, shell: 'zsh' });

    // The shell now talks to the target's view.
    const sessionId = pty.attachedSessions[0];
    if (sessionId === undefined) throw new Error('not attached');
    pty.emitData(sessionId, 'hello');
    expect(target.views.get(pane)?.text).toContain('hello');
    target.views.get(pane)?.input.emit('ls\r');
    expect(pty.writes.at(-1)).toEqual({ sessionId, data: 'ls\r' });
    expect(source.window.closed).toBe(0);
  });

  it('attaches the shells back when the target does not confirm', async () => {
    const pty = new FakePtyPort();
    const source = windowWith(pty, 's');
    source.workspace.ensureTab();
    await source.mount();
    const pane = source.workspace.activePane;
    if (pane === undefined) throw new Error('no pane');

    const sender = transferBetween(() => Promise.reject(new Error('timeout')), source);
    expect(await sender.moveTab(undefined, { kind: 'window', windowId: 9 })).toBe(false);
    expect(source.store.get().tabs).toHaveLength(1);
    expect(source.notify).toHaveBeenCalledWith(expect.stringContaining('stays in this window'));
    expect(pty.attachedSessions).toHaveLength(1);
    const sessionId = pty.attachedSessions[0] ?? '';
    pty.emitData(sessionId as never, 'still here');
    expect(source.views.get(pane)?.text).toContain('still here');
    expect(source.sessions.info.get().get(pane)?.pid).toBe(4242);
  });

  it('renames panes that clash with the target window and moving the last tab closes the source', async () => {
    const pty = new FakePtyPort();
    const source = windowWith(pty, 'same');
    const target = windowWith(pty, 'same');
    source.workspace.ensureTab();
    target.workspace.ensureTab();
    await source.mount();
    await target.mount();
    const receiver = transferBetween(() => Promise.resolve(false), target);
    const sender = transferBetween(async (payload) => {
      const imported = receiver.importTab(payload);
      await target.mount();
      return imported;
    }, source);
    expect(await sender.moveTab(undefined, { kind: 'point', x: 1, y: 1 })).toBe(true);
    const panes = target.store.get().tabs.flatMap((tab) => leafIds(tab.root));
    expect(new Set(panes).size).toBe(2);
    expect(source.window.closed).toBe(1);
  });
});
