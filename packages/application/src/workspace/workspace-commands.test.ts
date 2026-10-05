import { CommandIds, DEFAULT_SETTINGS, EMPTY_WORKSPACE, type Workspace } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { CommandRegistry } from '../command/command-registry';
import { ConfirmationService } from '../confirmation/confirmation-service';
import { FontZoom } from '../settings/font-zoom';
import { ObservableStore } from '../store/store';
import { SessionManager } from '../terminal/session-manager';
import { TerminalSessionService } from '../terminal/terminal-session-service';
import { FakePtyPort, FakeWindowPort, SequentialIdGenerator } from '../testing';
import { CoreCommands } from './workspace-commands';
import { WorkspaceService } from './workspace-service';

describe('CoreCommands', () => {
  it('registers every built-in command id', async () => {
    const settings = new ObservableStore(DEFAULT_SETTINGS);
    const store = new ObservableStore<Workspace>(EMPTY_WORKSPACE);
    const sessions = new SessionManager(
      new TerminalSessionService({ pty: new FakePtyPort(), ids: new SequentialIdGenerator() }),
    );
    const window = new FakeWindowPort();
    const workspace = new WorkspaceService({
      store,
      ids: new SequentialIdGenerator(),
      sessions,
      confirmation: new ConfirmationService(),
      settings,
      window,
    });
    const fontZoom = new FontZoom(settings);
    const registry = new CommandRegistry();
    registry.registerContribution(new CoreCommands({ workspace, sessions, fontZoom, window }));

    for (const id of Object.values(CommandIds)) expect(registry.has(id), id).toBe(true);

    registry.execute(CommandIds.tabNew);
    registry.execute(CommandIds.fontIncrease);
    registry.execute(CommandIds.windowNew);
    registry.execute(CommandIds.settingsOpen);
    registry.execute(CommandIds.terminalClear);
    registry.execute(CommandIds.tabSelect, 'bad');
    registry.execute(CommandIds.windowClose);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get().tabs).toHaveLength(1);
    expect(fontZoom.effective.get().fontSize).toBe(DEFAULT_SETTINGS.fontSize + 1);
    expect(window).toMatchObject({ newWindows: 1, settingsOpened: 1, closed: 1 });
  });
});
