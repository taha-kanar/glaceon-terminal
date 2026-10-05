import { CommandIds as C, type Direction } from '@glaceon/domain';
import type { Command, CommandContribution } from '../command/command';
import type { WindowPort } from '../ports/window-port';
import type { FontZoom } from '../settings/font-zoom';
import type { SessionManager } from '../terminal/session-manager';
import type { WorkspaceService } from './workspace-service';

export interface CoreCommandsDeps {
  readonly workspace: WorkspaceService;
  readonly sessions: SessionManager;
  readonly fontZoom: FontZoom;
  readonly window: WindowPort;
}

const DIRECTIONS: readonly (readonly [Direction, string])[] = [
  ['left', 'Left'],
  ['right', 'Right'],
  ['up', 'Up'],
  ['down', 'Down'],
];

/** Tab, pane, window and view commands. */
export class CoreCommands implements CommandContribution {
  readonly #deps: CoreCommandsDeps;

  constructor(deps: CoreCommandsDeps) {
    this.#deps = deps;
  }

  commands(): readonly Command[] {
    return [...this.#tabCommands(), ...this.#paneCommands(), ...this.#otherCommands()];
  }

  #tabCommands(): Command[] {
    const { workspace } = this.#deps;
    return [
      { id: C.tabNew, title: 'New Tab', category: 'Tab', run: () => void workspace.newTab() },
      { id: C.tabClose, title: 'Close Tab', category: 'Tab', run: () => workspace.closeTab() },
      { id: C.tabNext, title: 'Next Tab', category: 'Tab', run: () => workspace.cycleTab(1) },
      {
        id: C.tabPrevious,
        title: 'Previous Tab',
        category: 'Tab',
        run: () => workspace.cycleTab(-1),
      },
      {
        id: C.tabSelect,
        title: 'Select Tab',
        category: 'Tab',
        hideInPalette: true,
        run: (args) => {
          if (typeof args === 'number') workspace.selectTabAt(args);
        },
      },
    ];
  }

  #paneCommands(): Command[] {
    const { workspace } = this.#deps;
    const focus = DIRECTIONS.map(([direction, label]) => ({
      id: `pane.focus${label}`,
      title: `Focus Pane ${label}`,
      category: 'Pane',
      run: () => workspace.focusDirection(direction),
    }));
    const resize = DIRECTIONS.map(([direction, label]) => ({
      id: `pane.resize${label}`,
      title: `Resize Pane ${label}`,
      category: 'Pane',
      run: () => workspace.resize(direction),
    }));
    return [
      {
        id: C.paneSplitRight,
        title: 'Split Right',
        category: 'Pane',
        run: () => workspace.split('row').then(() => undefined),
      },
      {
        id: C.paneSplitDown,
        title: 'Split Down',
        category: 'Pane',
        run: () => workspace.split('column').then(() => undefined),
      },
      { id: C.paneClose, title: 'Close Pane', category: 'Pane', run: () => workspace.closePane() },
      ...focus,
      {
        id: C.paneFocusNext,
        title: 'Next Pane',
        category: 'Pane',
        run: () => workspace.focusOffset(1),
      },
      {
        id: C.paneFocusPrevious,
        title: 'Previous Pane',
        category: 'Pane',
        run: () => workspace.focusOffset(-1),
      },
      {
        id: C.paneToggleZoom,
        title: 'Toggle Pane Zoom',
        category: 'Pane',
        run: () => workspace.toggleZoom(),
      },
      {
        id: C.paneEqualize,
        title: 'Equalize Panes',
        category: 'Pane',
        run: () => workspace.equalize(),
      },
      ...resize,
    ];
  }

  #otherCommands(): Command[] {
    const { workspace, sessions, fontZoom, window } = this.#deps;
    return [
      { id: C.windowNew, title: 'New Window', category: 'Window', run: () => window.newWindow() },
      {
        id: C.windowClose,
        title: 'Close Window',
        category: 'Window',
        run: async () => {
          if (await workspace.confirmWindowClose()) window.close();
        },
      },
      {
        id: C.terminalClear,
        title: 'Clear Terminal',
        category: 'Terminal',
        run: () => {
          const pane = workspace.activePane;
          if (pane !== undefined) sessions.clear(pane);
        },
      },
      {
        id: C.fontIncrease,
        title: 'Increase Font Size',
        category: 'View',
        run: () => fontZoom.increase(),
      },
      {
        id: C.fontDecrease,
        title: 'Decrease Font Size',
        category: 'View',
        run: () => fontZoom.decrease(),
      },
      { id: C.fontReset, title: 'Reset Font Size', category: 'View', run: () => fontZoom.reset() },
      {
        id: C.settingsOpenFile,
        title: 'Open Settings File',
        category: 'Settings',
        run: () => window.openSettingsFile(),
      },
    ];
  }
}
