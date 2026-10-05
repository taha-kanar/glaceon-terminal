import { GeneralSection } from './GeneralSection';
import { KeybindingsSection } from './KeybindingsSection';
import type { SettingsSection } from './section';
import { ThemesSection } from './ThemesSection';

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: 'general', title: 'General', render: (props) => <GeneralSection {...props} /> },
  { id: 'themes', title: 'Themes', render: (props) => <ThemesSection {...props} /> },
  { id: 'keybindings', title: 'Keybindings', render: (props) => <KeybindingsSection {...props} /> },
];
