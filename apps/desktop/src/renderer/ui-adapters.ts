import type {
  ArrangementService,
  CommandRegistry,
  ContextKeys,
  JobService,
  KeybindingService,
  SearchService,
  SettingsWriter,
  TabTransferService,
  ThemeEditor,
  WorkspaceService,
} from '@glaceon/application';
import { INPUT_CAPTURE_CONTEXT, type ReadableStore } from '@glaceon/application';
import type { Settings } from '@glaceon/domain';
import type { AppModel, ArrangeActions, JobsModel } from '@glaceon/ui';

/** Adapts application services to the intents and models the React tree uses. */

export function arrangeActionsFor(
  services: { readonly arrangement: ArrangementService; readonly transfers: TabTransferService },
  refocus: () => void,
): ArrangeActions {
  const { arrangement, transfers } = services;
  return {
    moveToWindow: (tab, window) => {
      void transfers.moveTab(
        tab,
        window === undefined ? { kind: 'newWindow' } : { kind: 'window', windowId: window },
      );
    },
    tearOff: (tab, screen) => {
      void transfers.moveTab(tab, { kind: 'point', x: screen.x, y: screen.y });
    },
    beginRename: (target) => arrangement.beginRename(target),
    commitRename: (name) => {
      arrangement.commitRename(name);
      refocus();
    },
    cancelRename: () => {
      arrangement.cancelRename();
      refocus();
    },
    setColor: (tab, color) => arrangement.setColor(color, tab),
    togglePin: (tab) => arrangement.togglePin(tab),
    toggleLock: (tab) => arrangement.toggleLock(tab),
    moveTab: (tab, index) => arrangement.moveTab(tab, index),
    newGroup: (tab) => arrangement.newGroup(tab),
    setGroup: (tab, group) => arrangement.setGroup(group, tab),
    toggleGroupCollapsed: (group) => arrangement.toggleGroupCollapsed(group),
    setGroupColor: (group, color) => arrangement.setGroupColor(group, color),
    ungroup: (group) => arrangement.ungroup(group),
    movePane: (source, target, zone) => {
      arrangement.movePane(source, { target, zone });
      refocus();
    },
  };
}

export function settingsPanelModelFor(parts: {
  readonly settings: ReadableStore<Settings>;
  readonly writer: SettingsWriter;
  readonly themeEditor: ThemeEditor;
  readonly keybindings: KeybindingService;
  readonly registry: CommandRegistry;
  readonly context: ContextKeys;
  readonly openSettingsFile: () => void;
}): AppModel['settingsPanel'] {
  const { themeEditor, keybindings, registry, context, writer } = parts;
  return {
    settings: parts.settings,
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
    openSettingsFile: parts.openSettingsFile,
  };
}

export function searchModelFor(search: SearchService): AppModel['search'] {
  return {
    state: search.state,
    setQuery: (query) => search.setQuery(query),
    toggle: (option) => search.toggle(option),
    next: () => search.next(),
    previous: () => search.previous(),
    close: () => search.close(),
  };
}

export function jobsModelFor(jobs: JobService, workspace: WorkspaceService): JobsModel {
  return {
    jobs: jobs.jobs,
    watch: () => {
      const watching = jobs.watch();
      return () => {
        watching.dispose();
      };
    },
    signal: (pid, signal) => jobs.signal(pid, signal),
    focusPane: (pane) => workspace.focusPane(pane),
  };
}
