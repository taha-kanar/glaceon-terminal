import {
  activeTab,
  asPaneId,
  CommandIds,
  DEFAULT_SETTINGS,
  EMPTY_WORKSPACE,
  leafIds,
  type Settings,
  type Workspace,
} from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from '../command/command-registry';
import { ConfirmationService } from '../confirmation/confirmation-service';
import { ObservableStore } from '../store/store';
import { FakeWindowPort, SequentialIdGenerator } from '../testing';
import { ArrangementCommands } from './arrangement-commands';
import { ArrangementService } from './arrangement-service';
import { WorkspaceService } from './workspace-service';

function setup() {
  const store = new ObservableStore<Workspace>(EMPTY_WORKSPACE);
  const ids = new SequentialIdGenerator('id');
  const sessions = {
    prepare: vi.fn(),
    cwdOf: vi.fn(() => Promise.resolve('/work')),
    isBusy: () => false,
  };
  const notify = vi.fn();
  const workspace = new WorkspaceService({
    store,
    ids,
    // Only the parts these tests touch.
    sessions: sessions as unknown as ConstructorParameters<typeof WorkspaceService>[0]['sessions'],
    confirmation: new ConfirmationService(),
    settings: new ObservableStore<Settings>(DEFAULT_SETTINGS),
    window: new FakeWindowPort(),
    notify,
  });
  const service = new ArrangementService({ store, ids, sessions, notify });
  const registry = new CommandRegistry();
  registry.registerContribution(new ArrangementCommands(service));
  workspace.ensureTab();
  return { store, sessions, notify, workspace, service, registry };
}

const tab = (store: ObservableStore<Workspace>) => {
  const current = activeTab(store.get());
  if (current === undefined) throw new Error('no tab');
  return current;
};

describe('ArrangementService', () => {
  it('renames the active tab inline and clears the name with an empty one', () => {
    const { store, service, registry } = setup();
    registry.execute(CommandIds.tabRename);
    expect(service.renaming.get()).toEqual({ kind: 'tab', id: tab(store).id });
    service.commitRename('server');
    expect(tab(store).title).toBe('server');
    expect(service.renaming.get()).toBeUndefined();
    service.beginRename();
    service.cancelRename();
    expect(tab(store).title).toBe('server');
    service.beginRename();
    service.commitRename('');
    expect(tab(store).title).toBeUndefined();
  });

  it('creates groups with unused colors and starts renaming them', () => {
    const { store, service, workspace } = setup();
    service.newGroup();
    workspace.newTab();
    service.newGroup();
    const [first, second] = store.get().groups;
    expect(first?.color).not.toBe(second?.color);
    expect(service.renaming.get()).toEqual({ kind: 'group', id: second?.id });
    service.commitRename('db');
    expect(store.get().groups[1]?.name).toBe('db');
    if (first === undefined) throw new Error('no group');
    service.toggleGroupCollapsed(first.id);
    expect(store.get().groups[0]?.collapsed).toBe(true);
    service.ungroup(first.id);
    expect(store.get().groups).toHaveLength(1);
  });

  it('refuses to close locked and pinned tabs', async () => {
    const { store, service, workspace, notify } = setup();
    service.toggleLock();
    await workspace.closePane();
    await workspace.closeTab();
    expect(store.get().tabs).toHaveLength(1);
    expect(notify).toHaveBeenCalledWith('This tab is locked.');
    service.toggleLock();
    service.togglePin();
    await workspace.closeTab();
    expect(notify).toHaveBeenLastCalledWith('Pinned tabs cannot be closed.');
    service.togglePin();
    await workspace.closeTab();
    expect(store.get().tabs).toHaveLength(0);
  });

  it('applies layouts, opening extra panes in the current directory', async () => {
    const { store, service, sessions, notify } = setup();
    const before = leafIds(tab(store).root);
    await service.applyLayout('grid-2x2');
    const after = leafIds(tab(store).root);
    expect(after).toHaveLength(4);
    expect(after[0]).toBe(before[0]);
    expect(sessions.prepare).toHaveBeenCalledTimes(3);
    expect(sessions.prepare).toHaveBeenCalledWith(after[3], { cwd: '/work' });
    await service.applyLayout('columns');
    expect(leafIds(tab(store).root)).toEqual(after);
    service.paneToNewTab(asPaneId(after[3] ?? ''));
    await service.applyLayout('grid-2x2');
    await service.applyLayout('nope');
    expect(notify).not.toHaveBeenCalled();
  });

  it('offers a palette entry per layout and color', () => {
    const { service, store, registry } = setup();
    const invocations = new ArrangementCommands(service).invocations();
    expect(invocations.some((i) => i.args === 'grid-2x2')).toBe(true);
    const red = invocations.find((i) => i.title === 'Red');
    registry.execute(red?.command ?? '', red?.args);
    expect(tab(store).color).toBe('red');
    registry.execute(CommandIds.tabSetColor, 'not-a-color');
    expect(tab(store).color).toBeUndefined();
  });
});
