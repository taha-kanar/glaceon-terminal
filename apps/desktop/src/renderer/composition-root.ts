import {
  bindPaneLifecycle,
  CommandRegistry,
  computed,
  ConfirmationService,
  ContextKeys,
  CoreCommands,
  FontZoom,
  INPUT_CAPTURE_CONTEXT,
  KeybindingService,
  LinkService,
  SearchService,
  ToastService,
  ObservableStore,
  OverlayCommands,
  OverlayService,
  PaletteService,
  SessionManager,
  TerminalSessionService,
  ThemeCommands,
  ThemeEditor,
  WorkspaceService,
} from '@glaceon/application';
import type { SettingsSnapshot } from '@glaceon/contracts';
import { CommandIds, EMPTY_WORKSPACE, type Workspace } from '@glaceon/domain';
import {
  BrowserScheduler,
  MessagePortPtyClient,
  RandomIdGenerator,
  requestPtyPort,
  XtermViewRegistry,
} from '@glaceon/infrastructure/renderer';
import { App, type AppActions, type AppModel, type TerminalSlotBinder } from '@glaceon/ui';
import { createElement, type ReactElement } from 'react';
import { linkOpenerFor, settingsWriterFor, windowPortFor } from './bridge-adapters';
import { createE2EProbe } from './e2e-probe';
import { installKeyboardHandler } from './keyboard';
import { applyTheme } from './theme-applier';
import { viewOptions } from './view-options';

export interface RendererCompositionRoot {
  render(): ReactElement;
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

  // ---- settings and theme
  const settingsState = new ObservableStore<SettingsSnapshot>(snapshot);
  bridge.onSettingsChanged((next) => {
    settingsState.set(next);
  });
  const baseSettings = computed([settingsState], () => settingsState.get().settings);
  const fontZoom = new FontZoom(baseSettings);
  const settings = fontZoom.effective;
  const writer = settingsWriterFor(bridge);
  const themeEditor = new ThemeEditor({ settings: baseSettings, writer });
  const theme = themeEditor.theme;

  // ---- sessions and workspace
  const pty = new MessagePortPtyClient(port);
  const ids = new RandomIdGenerator();
  const sessions = new SessionManager(new TerminalSessionService({ pty, ids }));
  const workspaceStore = new ObservableStore<Workspace>(EMPTY_WORKSPACE);
  const confirmation = new ConfirmationService();
  const windowPort = windowPortFor(bridge);
  const workspace = new WorkspaceService({
    store: workspaceStore,
    ids,
    sessions,
    confirmation,
    settings,
    window: windowPort,
  });

  // ---- views: measure with the bundled font before the first terminal exists
  await target.document.fonts.load(`${String(settings.get().fontSize)}px "JetBrains Mono"`);
  const views = new XtermViewRegistry(target.document, viewOptions(settings.get(), theme.get()));
  const appearance = computed([settings, theme], () => ({
    settings: settings.get(),
    theme: theme.get(),
  }));
  const applyAppearance = (): void => {
    const current = appearance.get();
    views.setOptions(viewOptions(current.settings, current.theme));
    applyTheme(target.document.documentElement, current.theme, current.settings.backgroundOpacity);
  };
  applyAppearance();
  appearance.subscribe(applyAppearance);
  bindPaneLifecycle({ workspace: workspaceStore, service: workspace, sessions, views, settings });

  // ---- commands, keybindings, overlays
  const context = new ContextKeys();
  const overlay = new OverlayService(context);
  const registry = new CommandRegistry();
  const themeCommands = new ThemeCommands({ settings: baseSettings, writer, overlay });
  registry.registerContribution(
    new CoreCommands({ workspace, sessions, fontZoom, window: windowPort }),
  );
  registry.registerContribution(new OverlayCommands(overlay));
  registry.registerContribution(themeCommands);
  registry.onDidFail(({ commandId, error }) => {
    console.error(`[renderer] command ${commandId} failed`, error);
  });
  views.onFocusChange(({ focused }) => {
    context.set('terminalFocus', focused);
  });
  const keybindings = new KeybindingService({
    registry,
    context,
    userBindings: computed([settings], () => settings.get().keybindings),
  });
  const palette = new PaletteService({
    registry,
    providers: [themeCommands],
    keybindings: keybindings.resolver,
    overlay,
  });
  const refocus = (): void => {
    const pane = workspace.activePane;
    if (pane !== undefined) sessions.focus(pane);
  };
  overlay.onDidClose(() => {
    themeEditor.cancel();
    context.set(INPUT_CAPTURE_CONTEXT, false);
    refocus();
  });
  const search = new SearchService({
    targets: views,
    context,
    activePane: () => workspace.activePane,
    onClose: refocus,
  });
  registry.registerContribution(search);
  // Search follows the pane it was opened in; switching panes closes it.
  workspaceStore.subscribe(() => {
    const open = search.state.get();
    if (open !== undefined && open.pane !== workspace.activePane) search.close();
  });
  const toasts = new ToastService(new BrowserScheduler());
  const links = new LinkService({ opener: linkOpenerFor(bridge), sessions, toasts });
  views.onLinkActivated(({ pane, link, event }) => {
    // Plain clicks select text; ⌘-click opens.
    if (event.metaKey) void links.open(pane, link);
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
      refocus();
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
    overlay: overlay.state,
    closeOverlay: () => overlay.close(),
    palette: { items: (query) => palette.items(query), run: (item) => palette.run(item) },
    settingsPanel: {
      settings: baseSettings,
      update: (key, value) => writer.update(key, value),
      themes: {
        draft: themeEditor.draft,
        begin: (id) => themeEditor.begin(id),
        setColor: (key, color) => themeEditor.setColor(key, color),
        rename: (name) => themeEditor.rename(name),
        save: () => themeEditor.save(),
        cancel: () => themeEditor.cancel(),
        remove: (id) => themeEditor.remove(id),
      },
      keybindings: {
        resolver: keybindings.resolver,
        commands: () => registry.list(),
        setCapture: (capturing) => context.set(INPUT_CAPTURE_CONTEXT, capturing),
      },
      openSettingsFile: () => windowPort.openSettingsFile(),
    },
    search: {
      state: search.state,
      setQuery: (query) => search.setQuery(query),
      toggle: (option) => search.toggle(option),
      next: () => search.next(),
      previous: () => search.previous(),
      close: () => search.close(),
    },
    toasts: { items: toasts.toasts, dismiss: (id) => toasts.dismiss(id) },
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
