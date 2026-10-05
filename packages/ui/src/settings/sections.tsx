import { GeneralSection } from './GeneralSection';
import { KeybindingsSection } from './KeybindingsSection';
import type { SettingsSection } from './section';
import { ThemesSection } from './ThemesSection';
import { WindowSection } from './WindowSection';

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: 'general', title: 'General', render: (props) => <GeneralSection {...props} /> },
  { id: 'window', title: 'Window', render: (props) => <WindowSection {...props} /> },
  { id: 'themes', title: 'Themes', render: (props) => <ThemesSection {...props} /> },
  { id: 'keybindings', title: 'Keybindings', render: (props) => <KeybindingsSection {...props} /> },
];
