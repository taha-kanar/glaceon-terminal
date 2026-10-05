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
import { ContextKeys } from '../keybinding/context-keys';
import { JobCommands } from '../jobs/job-commands';
import { OverlayCommands } from '../overlay/overlay-commands';
import { OverlayService } from '../overlay/overlay-service';
import { ThemeCommands } from '../theme/theme-commands';
import { SearchService } from '../search/search-service';
import { ArrangementCommands } from './arrangement-commands';
import { TabTransferService } from '../transfer/tab-transfer-service';
import { TransferCommands } from '../transfer/transfer-commands';
import { ArrangementService } from './arrangement-service';
import { FakeSettingsWriter } from '../testing';
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
    registry.registerContribution(
      new ArrangementCommands(
        new ArrangementService({
          store,
          ids: new SequentialIdGenerator(),
          sessions,
          notify: () => undefined,
        }),
      ),
    );
    registry.registerContribution(
      new TransferCommands(
        new TabTransferService({
          store,
          workspace,
          sessions,
          views: { snapshot: () => undefined },
          port: { send: () => Promise.resolve(false) },
          ids: new SequentialIdGenerator(),
          notify: () => undefined,
        }),
        new ObservableStore([]),
      ),
    );
    const overlay = new OverlayService(new ContextKeys());
    registry.registerContribution(new OverlayCommands(overlay));
    registry.registerContribution(new JobCommands(overlay));
    registry.registerContribution(
      new ThemeCommands({ settings, writer: new FakeSettingsWriter(settings), overlay }),
    );

    registry.registerContribution(
      new SearchService({
        targets: { searchable: () => undefined },
        context: new ContextKeys(),
        activePane: () => undefined,
        onClose: () => undefined,
      }),
    );
    for (const id of Object.values(CommandIds)) expect(registry.has(id), id).toBe(true);

    registry.execute(CommandIds.tabNew);
    registry.execute(CommandIds.fontIncrease);
    registry.execute(CommandIds.windowNew);
    registry.execute(CommandIds.settingsOpenFile);
    registry.execute(CommandIds.terminalClear);
    registry.execute(CommandIds.tabSelect, 'bad');
    registry.execute(CommandIds.windowClose);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get().tabs).toHaveLength(1);
    expect(fontZoom.effective.get().fontSize).toBe(DEFAULT_SETTINGS.fontSize + 1);
    expect(window).toMatchObject({ newWindows: 1, settingsOpened: 1, closed: 1 });
  });
});
