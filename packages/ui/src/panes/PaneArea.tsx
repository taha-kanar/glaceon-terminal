import type { SessionInfoMap } from '@glaceon/application';
import { activeTab, leafIds, type Workspace } from '@glaceon/domain';
import { useRef, type ReactElement } from 'react';
import type { AppActions, TerminalSlotBinder } from '../app/app-model';
import { Divider } from './Divider';
import { placePanes, visibleDividers } from './pane-geometry';
import { PaneSlot } from './PaneSlot';

export interface PaneAreaProps {
  readonly workspace: Workspace;
  readonly sessions: SessionInfoMap;
  readonly actions: AppActions;
  readonly bindSlot: TerminalSlotBinder;
}

export function PaneArea({ workspace, sessions, actions, bindSlot }: PaneAreaProps): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const current = activeTab(workspace);
  const split = current !== undefined && !current.zoomed && leafIds(current.root).length > 1;

  return (
    <main className="workspace">
      <div ref={container} className="workspace__panes">
        {placePanes(workspace).map((placed) => (
          <PaneSlot
            key={placed.pane}
            placed={placed}
            info={sessions.get(placed.pane)}
            dimmed={split && placed.visible && !placed.focused}
            bindSlot={bindSlot}
            actions={actions}
          />
        ))}
        {current !== undefined &&
          visibleDividers(workspace).map((divider) => (
            <Divider
              key={`${current.id}:${divider.path.join('.')}`}
              divider={divider}
              container={container}
              onRatio={(ratio) => {
                actions.setSplitRatio(current.id, divider.path, ratio);
              }}
            />
          ))}
      </div>
    </main>
  );
}
