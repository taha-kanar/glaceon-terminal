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
import { JobsPanel } from '../jobs/JobsPanel';
import { ProcessIndicator } from '../jobs/ProcessPopover';
import { ClipboardPicker } from '../tools/ClipboardPicker';
import { SnippetPicker } from '../tools/SnippetPicker';
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
  const renaming = useStore(model.renaming);
  const windows = useStore(model.windows);
  const { actions } = model;

  return (
    <div className={model.windowKind === 'quake' ? 'app app--quake' : 'app'}>
      <TabBar
        workspace={workspace}
        sessions={sessions}
        actions={actions}
        arrange={model.arrange}
        renaming={renaming}
        windows={windows}
        newTabLabel={model.labelFor(CommandIds.tabNew)}
        trailing={<ProcessIndicator workspace={workspace} sessions={sessions} model={model.jobs} />}
      />
      {problems.length > 0 && (
        <ProblemsBanner problems={problems} onOpenSettings={actions.openSettingsFile} />
      )}
      <PaneArea
        workspace={workspace}
        sessions={sessions}
        actions={actions}
        arrange={model.arrange}
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
      {overlay?.kind === 'jobs' && (
        <JobsPanel
          workspace={workspace}
          sessions={sessions}
          model={model.jobs}
          onClose={model.closeOverlay}
        />
      )}
      {overlay?.kind === 'clipboard' && (
        <ClipboardPicker model={model.tools} onClose={model.closeOverlay} />
      )}
      {overlay?.kind === 'snippets' && (
        <SnippetPicker model={model.tools} initial={overlay.target} onClose={model.closeOverlay} />
      )}
      {confirmation !== undefined && (
        <ConfirmDialog request={confirmation} onAnswer={actions.answerConfirmation} />
      )}
    </div>
  );
}
