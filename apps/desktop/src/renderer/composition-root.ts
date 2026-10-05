import {
  bindPaneLifecycle,
  CommandRegistry,
  computed,
  ConfirmationService,
  ContextKeys,
  CoreCommands,
  FontZoom,
  KeybindingService,
  ObservableStore,
  SessionManager,
  TerminalSessionService,
  WorkspaceService,
  type WindowPort,
} from '@glaceon/application';
import type { SettingsSnapshot } from '@glaceon/contracts';
import {
  CommandIds,
  EMPTY_WORKSPACE,
  resolveTheme,
  type Settings,
  type Workspace,
} from '@glaceon/domain';
import {
  MessagePortPtyClient,
  RandomIdGenerator,
  requestPtyPort,
  toXtermTheme,
  XtermViewRegistry,
  type XtermViewOptions,
} from '@glaceon/infrastructure/renderer';
import { App, type AppActions, type AppModel, type TerminalSlotBinder } from '@glaceon/ui';
import { createElement, type ReactElement } from 'react';
import { createE2EProbe } from './e2e-probe';
import { installKeyboardHandler } from './keyboard';
import { applyTheme } from './theme-applier';

export interface RendererCompositionRoot {
  render(): ReactElement;
}

function viewOptions(settings: Settings): XtermViewOptions {
  return {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    letterSpacing: settings.letterSpacing,
    theme: toXtermTheme(resolveTheme(settings.theme)),
    cursorStyle: settings.cursorStyle,
    cursorBlink: settings.cursorBlink,
    scrollback: settings.scrollback,
    macOptionIsMeta: settings.macOptionIsMeta,
  };
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i]);

/** Wires one renderer window: pty client, services, xterm views and the React tree. */
export async function createRendererCompositionRoot(
  target: Window,
): Promise<RendererCompositionRoot> {
  const bridge = target.glaceon;
  const [port, snapshot] = await Promise.all([
    requestPtyPort(bridge, target),
    bridge.getSettings(),
  ]);

  const settingsState = new ObservableStore<SettingsSnapshot>(snapshot);
  bridge.onSettingsChanged((next) => {
    settingsState.set(next);
  });
  const fontZoom = new FontZoom(computed([settingsState], () => settingsState.get().settings));
  const settings = fontZoom.effective;

  const pty = new MessagePortPtyClient(port);
  const ids = new RandomIdGenerator();
  const sessions = new SessionManager(new TerminalSessionService({ pty, ids }));
  const workspaceStore = new ObservableStore<Workspace>(EMPTY_WORKSPACE);
  const confirmation = new ConfirmationService();
  const windowPort: WindowPort = {
    newWindow: () => bridge.newWindow(),
    close: () => bridge.closeWindow(),
    openSettingsFile: () => bridge.openSettingsFile(),
  };
  const workspace = new WorkspaceService({
    store: workspaceStore,
    ids,
    sessions,
    confirmation,
    settings,
    window: windowPort,
  });

  // Measure with the bundled font, not a fallback, before the first terminal is created.
  await target.document.fonts.load(`${String(settings.get().fontSize)}px "JetBrains Mono"`);
  const views = new XtermViewRegistry(target.document, viewOptions(settings.get()));
  applyTheme(target.document.documentElement, settings.get());
  settings.subscribe(() => {
    views.setOptions(viewOptions(settings.get()));
    applyTheme(target.document.documentElement, settings.get());
  });
  bindPaneLifecycle({ workspace: workspaceStore, service: workspace, sessions, views, settings });

  const registry = new CommandRegistry();
  registry.registerContribution(
    new CoreCommands({ workspace, sessions, fontZoom, window: windowPort }),
  );
  registry.onDidFail(({ commandId, error }) => {
    console.error(`[renderer] command ${commandId} failed`, error);
  });
  const context = new ContextKeys();
  views.onFocusChange(({ focused }) => {
    context.set('terminalFocus', focused);
  });
  const keybindings = new KeybindingService({
    registry,
    context,
    userBindings: computed([settings], () => settings.get().keybindings),
  });
  installKeyboardHandler(target, keybindings);
  bridge.onRunCommand(({ command, args }) => {
    registry.execute(command, args);
  });
  bridge.onCloseRequested(() => {
    registry.execute(CommandIds.windowClose);
  });

  const problems = computed(
    [settingsState, keybindings.resolver],
    () => [...settingsState.get().problems, ...keybindings.resolver.get().problems],
    sameList,
  );

  const bindSlot: TerminalSlotBinder = (pane, element) => {
    const { view, created } = views.attach(pane, element);
    if (created) void sessions.open(pane, view);
    return () => {
      views.detach(pane, element);
    };
  };

  const actions: AppActions = {
    runCommand: (command, args) => registry.execute(command, args),
    selectTab: (tab) => workspace.selectTab(tab),
    closeTab: (tab) => void workspace.closeTab(tab),
    focusPane: (pane) => workspace.focusPane(pane),
    setSplitRatio: (tab, path, ratio) => workspace.setRatio(tab, { path, ratio }),
    restartPane: (pane) => void sessions.restart(pane),
    dismissPane: (pane) => workspace.dismissPane(pane),
    answerConfirmation: (confirmed) => {
      confirmation.answer(confirmed);
      const pane = workspace.activePane;
      if (pane !== undefined) sessions.focus(pane);
    },
    openSettingsFile: () => windowPort.openSettingsFile(),
  };

  const model: AppModel = {
    workspace: workspaceStore,
    sessions: sessions.info,
    settings,
    problems,
    confirmation: confirmation.current,
    labelFor: (command) => keybindings.resolver.get().labelFor(command),
    actions,
    bindSlot,
  };

  workspace.ensureTab();

  if (bridge.e2e) {
    target.__glaceonE2E = createE2EProbe({
      workspace: workspaceStore,
      sessions,
      views,
      problems,
      fontSize: () => settings.get().fontSize,
    });
  }

  return {
    render: () => createElement(App, { model }),
  };
}
