import type { Settings } from '@glaceon/domain';
import type { ReactElement } from 'react';
import type { SettingsPanelModel } from './settings-panel-model';

export interface SectionProps {
  readonly model: SettingsPanelModel;
  readonly settings: Settings;
  /** Reports the outcome of a write so the panel can show errors. */
  readonly report: (result: { readonly ok: boolean; readonly error?: string }) => void;
}

/** One page of the settings panel. New pages are added to the registry, not to the panel. */
export interface SettingsSection {
  readonly id: string;
  readonly title: string;
  readonly render: (props: SectionProps) => ReactElement;
}
