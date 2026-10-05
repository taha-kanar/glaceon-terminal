import {
  activeTab,
  DEFAULT_SETTINGS,
  EMPTY_WORKSPACE,
  leafIds,
  type Settings,
  type Workspace,
} from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { ConfirmationService } from '../confirmation/confirmation-service';
import { ObservableStore } from '../store/store';
import { SessionManager } from '../terminal/session-manager';
import { TerminalSessionService } from '../terminal/terminal-session-service';
import {
  FakePtyPort,
  FakeTerminalView,
  FakeTerminalViewRegistry,
  FakeWindowPort,
  SequentialIdGenerator,
} from '../testing';
import { bindPaneLifecycle } from './pane-lifecycle';
import { WorkspaceService } from './workspace-service';

function setup(settings: Partial<Settings> = {}) {
  const pty = new FakePtyPort();
  const store = new ObservableStore<Workspace>(EMPTY_WORKSPACE);
  const sessions = new SessionManager(
    new TerminalSessionService({ pty, ids: new SequentialIdGenerator('s') }),
  );
  const confirmation = new ConfirmationService();
  const window = new FakeWindowPort();
  const settingsStore = new ObservableStore<Settings>({ ...DEFAULT_SETTINGS, ...settings });
  const service = new WorkspaceService({
    store,
    ids: new SequentialIdGenerator('w'),
    sessions,
    confirmation,
    settings: settingsStore,
    window,
  });
  const views = new FakeTerminalViewRegistry();
  bindPaneLifecycle({ workspace: store, service, sessions, views, settings: settingsStore });
  /** Simulates the UI mounting a view for every pane. */
  const mountAll = async () => {
    for (const pane of store.get().tabs.flatMap((t) => leafIds(t.root))) {
      if (!sessions.has(pane)) await sessions.open(pane, new FakeTerminalView());
    }
  };
  return { pty, store, sessions, confirmation, window, service, views, mountAll };
}

describe('WorkspaceService', () => {
  it('opens a first tab and new tabs after the active one', () => {
    const { service, store } = setup();
    service.ensureTab();
    service.ensureTab();
    expect(store.get().tabs).toHaveLength(1);
    service.newTab();
    service.selectTabAt(1);
    service.newTab();
    expect(store.get().tabs.map((t) => t.id)).toEqual(['w-2', 'w-6', 'w-4']);
  });

  it('splits with the working directory of the active pane', async () => {
    const { service, store, pty, mountAll } = setup();
    service.ensureTab();
    await mountAll();
    pty.cwdResult = '/repo';
    const pane = await service.split('row');
    await mountAll();
    expect(activeTab(store.get())?.activePane).toBe(pane);
    expect(pty.spawned.at(-1)?.cwd).toBe('/repo');
  });

  it('asks before closing a pane with a running program', async () => {
    const { service, store, pty, confirmation, mountAll } = setup();
    service.ensureTab();
    await service.split('row');
    await mountAll();
    pty.emitProcess(pty.spawned[1]!.sessionId, 'vim');

    const closing = service.closePane();
    expect(confirmation.current.get()?.message).toBe('vim is still running.');
    confirmation.answer(false);
    await closing;
    expect(leafIds(activeTab(store.get())!.root)).toHaveLength(2);

    const again = service.closePane();
    confirmation.answer(true);
    await again;
    expect(leafIds(activeTab(store.get())!.root)).toHaveLength(1);
  });

  it('does not ask when confirmation is disabled', async () => {
    const { service, store, pty, confirmation, mountAll } = setup({
      confirmCloseRunningProcess: false,
    });
    service.ensureTab();
    await mountAll();
    pty.emitProcess(pty.spawned[0]!.sessionId, 'top');
    await service.closeTab();
    expect(confirmation.current.get()).toBeUndefined();
    expect(store.get().tabs).toHaveLength(0);
  });

  it('closes the window when the last tab goes away', async () => {
    const { service, window } = setup();
    service.ensureTab();
    await service.closePane();
    expect(window.closed).toBe(1);
  });

  it('navigates, cycles, zooms, resizes and selects tabs', async () => {
    const { service, store } = setup();
    service.ensureTab();
    const first = service.activePane!;
    const second = await service.split('row');
    service.focusDirection('left');
    expect(service.activePane).toBe(first);
    service.focusOffset(1);
    expect(service.activePane).toBe(second);
    service.toggleZoom();
    service.focusDirection('left');
    expect(service.activePane).toBe(second);
    service.toggleZoom();
    service.resize('left');
    expect(activeTab(store.get())?.root).toMatchObject({ ratio: 0.45 });
    service.equalize();
    service.setRatio(store.get().activeTab!, { path: [], ratio: 0.3 });
    expect(activeTab(store.get())?.root).toMatchObject({ ratio: 0.3 });
    service.newTab();
    service.cycleTab(1);
    expect(store.get().activeTab).toBe(store.get().tabs[0]?.id);
    service.selectTabAt(9);
    expect(store.get().activeTab).toBe(store.get().tabs[1]?.id);
  });

  it('confirms window close only when something is running', async () => {
    const { service, pty, confirmation, mountAll } = setup();
    service.ensureTab();
    await mountAll();
    expect(await service.confirmWindowClose()).toBe(true);
    pty.emitProcess(pty.spawned[0]!.sessionId, 'ssh');
    const answer = service.confirmWindowClose();
    confirmation.answer(true);
    expect(await answer).toBe(true);
  });
});

describe('pane lifecycle', () => {
  it('releases sessions and views of closed panes and hides inactive tabs', async () => {
    const { service, store, views, pty, mountAll } = setup();
    service.ensureTab();
    const firstPane = service.activePane!;
    await mountAll();
    service.newTab();
    await mountAll();
    expect(views.visibility.get(firstPane)).toBe(false);
    await service.closeTab();
    expect(views.released).toHaveLength(1);
    expect(pty.killed).toHaveLength(1);
    expect(views.visibility.get(firstPane)).toBe(true);
    expect(store.get().tabs).toHaveLength(1);
  });

  it('closes panes whose shell exits cleanly under the default policy', async () => {
    const { service, store, pty, mountAll } = setup();
    service.ensureTab();
    await service.split('row');
    await mountAll();
    pty.emitExit(pty.spawned[1]!.sessionId, { exitCode: 1 });
    expect(leafIds(activeTab(store.get())!.root)).toHaveLength(2);
    pty.emitExit(pty.spawned[0]!.sessionId, { exitCode: 0 });
    expect(leafIds(activeTab(store.get())!.root)).toHaveLength(1);
  });

  it('keeps exited panes with closeOnExit "never" and closes them all with "always"', async () => {
    const never = setup({ closeOnExit: 'never' });
    never.service.ensureTab();
    await never.mountAll();
    never.pty.emitExit(never.pty.spawned[0]!.sessionId, { exitCode: 0 });
    expect(never.store.get().tabs).toHaveLength(1);

    const always = setup({ closeOnExit: 'always' });
    always.service.ensureTab();
    await always.mountAll();
    always.pty.emitExit(always.pty.spawned[0]!.sessionId, { exitCode: 0, signal: 9 });
    expect(always.store.get().tabs).toHaveLength(0);
  });
});
