import { CommandIds } from '@glaceon/domain';
import type { ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import { ConfirmDialog } from '../overlays/ConfirmDialog';
import { ProblemsBanner } from '../overlays/ProblemsBanner';
import { PaneArea } from '../panes/PaneArea';
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
      {confirmation !== undefined && (
        <ConfirmDialog request={confirmation} onAnswer={actions.answerConfirmation} />
      )}
    </div>
  );
}
