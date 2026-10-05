import type {
  Command,
  KeybindingResolver,
  QuakeStatus,
  ReadableStore,
  ThemeColorKey,
} from '@glaceon/application';
import type { Result, Settings, Theme } from '@glaceon/domain';

export type UpdateSetting = <K extends keyof Settings>(
  key: K,
  value: Settings[K],
) => Promise<Result<void, string>>;

/** The theme editor as the settings panel uses it. */
export interface ThemeEditorModel {
  readonly draft: ReadableStore<Theme | undefined>;
  readonly begin: (baseId?: string) => void;
  readonly setColor: (key: ThemeColorKey, color: string) => void;
  readonly rename: (name: string) => void;
  readonly save: () => Promise<Result<void, string>>;
  readonly cancel: () => void;
  readonly remove: (id: string) => Promise<Result<void, string>>;
}

export interface KeybindingsModel {
  readonly resolver: ReadableStore<KeybindingResolver>;
  readonly commands: () => readonly Command[];
  /** While true, shortcuts are suspended so a key recorder sees every key. */
  readonly setCapture: (capturing: boolean) => void;
}

export interface SettingsPanelModel {
  /** The configured settings (without per-window font zoom). */
  readonly settings: ReadableStore<Settings>;
  readonly update: UpdateSetting;
  readonly themes: ThemeEditorModel;
  readonly keybindings: KeybindingsModel;
  readonly openSettingsFile: () => void;
  /** Whether the quake shortcut is registered (undefined until main reports it). */
  readonly quakeStatus: ReadableStore<QuakeStatus | undefined>;
}
