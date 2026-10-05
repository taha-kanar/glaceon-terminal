import { DEFAULT_SETTINGS, type Settings } from '@glaceon/domain';

/** The settings in effect plus any problems found in the file they came from. */
export interface SettingsState {
  readonly settings: Settings;
  /** Non-empty when the file could not be used; `settings` then holds the last good values. */
  readonly problems: readonly string[];
}

export const INITIAL_SETTINGS_STATE: SettingsState = { settings: DEFAULT_SETTINGS, problems: [] };
