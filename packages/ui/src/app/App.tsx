import { CommandIds } from '@glaceon/domain';
import type { ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import { ConfirmDialog } from '../overlays/ConfirmDialog';
import { ProblemsBanner } from '../overlays/ProblemsBanner';
import { PaneArea } from '../panes/PaneArea';
import { Toasts } from '../overlays/Toasts';
import { CommandPalette } from '../palette/CommandPalette';
import { SearchBar } from '../search/SearchBar';
import { SETTINGS_SECTIONS } from '../settings/sections';
import { SettingsPanel } from '../settings/SettingsPanel';
import { TabBar } from '../tabs/TabBar';
import type { AppModel } from './app-model';

export interface AppProps {
  readonly model: AppModel;
}

export function App({ model }: AppProps): ReactElement {
  const workspace = useStore(model.workspace);
  const sessions = useStore(model.sessions);
  const problems = useStore(model.problems);
  const confirmation = useStore(model.confirmation);
  const overlay = useStore(model.overlay);
  const search = useStore(model.search.state);
  const toasts = useStore(model.toasts.items);
  const { actions } = model;

  return (
    <div className="app">
      <TabBar
        workspace={workspace}
        sessions={sessions}
        actions={actions}
        newTabLabel={model.labelFor(CommandIds.tabNew)}
      />
      {problems.length > 0 && (
        <ProblemsBanner problems={problems} onOpenSettings={actions.openSettingsFile} />
      )}
      <PaneArea
        workspace={workspace}
        sessions={sessions}
        actions={actions}
        bindSlot={model.bindSlot}
      />
      {search !== undefined && <SearchBar state={search} actions={model.search} />}
      <Toasts toasts={toasts} onDismiss={model.toasts.dismiss} />
      {overlay?.kind === 'palette' && (
        <CommandPalette
          items={model.palette.items}
          onRun={model.palette.run}
          onClose={model.closeOverlay}
        />
      )}
      {overlay?.kind === 'settings' && (
        <SettingsPanel
          model={model.settingsPanel}
          sections={SETTINGS_SECTIONS}
          initialSection={overlay.target}
          onClose={model.closeOverlay}
        />
      )}
      {confirmation !== undefined && (
        <ConfirmDialog request={confirmation} onAnswer={actions.answerConfirmation} />
      )}
    </div>
  );
}
