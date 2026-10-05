import type { SessionInfoMap } from '@glaceon/application';
import { activeTab, leafIds, type Workspace } from '@glaceon/domain';
import { useRef, type ReactElement } from 'react';
import type { AppActions, TerminalSlotBinder } from '../app/app-model';
import type { ArrangeActions } from '../tabs/arrange-actions';
import { Divider } from './Divider';
import { placePanes, rectStyle, visibleDividers } from './pane-geometry';
import { PaneSlot } from './PaneSlot';
import { usePaneDrag } from './use-pane-drag';

export interface PaneAreaProps {
  readonly workspace: Workspace;
  readonly sessions: SessionInfoMap;
  readonly actions: AppActions;
  readonly arrange: ArrangeActions;
  readonly bindSlot: TerminalSlotBinder;
}

export function PaneArea(props: PaneAreaProps): ReactElement {
  const { workspace, sessions, actions, bindSlot } = props;
  const container = useRef<HTMLDivElement>(null);
  const current = activeTab(workspace);
  const split = current !== undefined && !current.zoomed && leafIds(current.root).length > 1;
  const placed = placePanes(workspace);
  const drag = usePaneDrag(container, placed, props.arrange.movePane);

  return (
    <main className={drag.source === undefined ? 'workspace' : 'workspace workspace--dragging'}>
      <div ref={container} className="workspace__panes">
        {placed.map((pane) => (
          <PaneSlot
            key={pane.pane}
            placed={pane}
            info={sessions.get(pane.pane)}
            dimmed={split && pane.visible && !pane.focused}
            draggable={split && pane.visible}
            dragging={drag.source === pane.pane}
            onGrab={drag.onPointerDown}
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
        {drag.target !== undefined && (
          <div
            className={`drop-preview drop-preview--${drag.target.zone}`}
            style={rectStyle(drag.target.preview)}
            data-testid="drop-preview"
            data-zone={drag.target.zone}
          />
        )}
      </div>
    </main>
  );
}
