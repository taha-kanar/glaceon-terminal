import type {
  CommandArgs,
  ConfirmationRequest,
  OverlayState,
  PaletteItem,
  SearchState,
  Toast,
  ReadableStore,
  RenameTarget,
  SessionInfoMap,
} from '@glaceon/application';
import type { PaneId, Settings, SplitPath, TabId, Workspace } from '@glaceon/domain';
import type { SearchActions } from '../search/SearchBar';
import type { SettingsPanelModel } from '../settings/settings-panel-model';
import type { ArrangeActions } from '../tabs/arrange-actions';
import type { JobsModel } from '../jobs/jobs-model';

/** Lets a pane slot host the terminal view of a pane. Returns the detach function. */
export type TerminalSlotBinder = (pane: PaneId, element: HTMLElement) => () => void;

/** User intents the UI reports. The composition root routes them to application services. */
export interface AppActions {
  readonly runCommand: (command: string, args?: CommandArgs) => void;
  readonly selectTab: (tab: TabId) => void;
  readonly closeTab: (tab: TabId) => void;
  readonly focusPane: (pane: PaneId) => void;
  readonly setSplitRatio: (tab: TabId, path: SplitPath, ratio: number) => void;
  readonly restartPane: (pane: PaneId) => void;
  readonly dismissPane: (pane: PaneId) => void;
  readonly answerConfirmation: (confirmed: boolean) => void;
  readonly openSettingsFile: () => void;
}

/** Everything the React tree reads (stores) and reports (actions). */
export interface AppModel {
  readonly workspace: ReadableStore<Workspace>;
  readonly sessions: ReadableStore<SessionInfoMap>;
  readonly settings: ReadableStore<Settings>;
  readonly problems: ReadableStore<readonly string[]>;
  readonly confirmation: ReadableStore<ConfirmationRequest | undefined>;
  readonly labelFor: (command: string) => string | undefined;
  readonly actions: AppActions;
  readonly arrange: ArrangeActions;
  readonly renaming: ReadableStore<RenameTarget | undefined>;
  readonly bindSlot: TerminalSlotBinder;
  readonly overlay: ReadableStore<OverlayState | undefined>;
  readonly closeOverlay: () => void;
  readonly palette: {
    readonly items: (query: string) => readonly PaletteItem[];
    readonly run: (item: PaletteItem) => void;
  };
  readonly settingsPanel: SettingsPanelModel;
  readonly search: SearchActions & { readonly state: ReadableStore<SearchState | undefined> };
  readonly jobs: JobsModel;
  readonly toasts: {
    readonly items: ReadableStore<readonly Toast[]>;
    readonly dismiss: (id: number) => void;
  };
}
