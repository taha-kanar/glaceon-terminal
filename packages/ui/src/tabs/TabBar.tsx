import type { RenameTarget, SessionInfoMap, WindowSummary } from '@glaceon/application';
import { CommandIds, leafIds, type Workspace } from '@glaceon/domain';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import type { AppActions } from '../app/app-model';
import { ContextMenu, type MenuEntry } from '../menu/ContextMenu';
import type { ArrangeActions } from './arrange-actions';
import { RenameInput } from './RenameInput';
import { tabBarEntries } from './tab-bar-entries';
import { groupMenu, tabMenu } from './tab-menus';
import { tabTitle } from './tab-title';
import { TabItem } from './TabItem';
import { useTabDrag } from './use-tab-drag';

export interface TabBarProps {
  readonly workspace: Workspace;
  readonly sessions: SessionInfoMap;
  readonly actions: AppActions;
  readonly arrange: ArrangeActions;
  readonly renaming: RenameTarget | undefined;
  /** All windows, for “Move to Window”. */
  readonly windows: readonly WindowSummary[];
  readonly newTabLabel: string | undefined;
}

interface OpenMenu {
  readonly x: number;
  readonly y: number;
  readonly entries: readonly MenuEntry[];
}

export function TabBar(props: TabBarProps): ReactElement {
  const { workspace, sessions, actions, arrange, renaming } = props;
  const list = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<OpenMenu | undefined>(undefined);
  const closeMenu = useCallback(() => {
    setMenu(undefined);
  }, []);
  const drag = useTabDrag(list, workspace, { move: arrange.moveTab, tearOff: arrange.tearOff });

  return (
    <nav className="tabbar">
      <div
        ref={list}
        className={drag.state?.tearing === true ? 'tabs tabs--tearing' : 'tabs'}
        role="tablist"
      >
        {tabBarEntries(workspace).map((entry) => {
          if (entry.kind === 'group') {
            const { group } = entry;
            const editing = renaming?.kind === 'group' && renaming.id === group.id;
            return (
              <div
                key={`group:${group.id}`}
                className={group.collapsed ? 'tab-group tab-group--collapsed' : 'tab-group'}
                style={{ background: `var(--tab-${group.color})` }}
                data-testid="tab-group"
                title={group.collapsed ? `${group.name} (${String(entry.count)} tabs)` : group.name}
                onClick={() => {
                  arrange.toggleGroupCollapsed(group.id);
                }}
                onDoubleClick={() => {
                  arrange.beginRename({ kind: 'group', id: group.id });
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    entries: groupMenu(group, arrange),
                  });
                }}
              >
                {editing ? (
                  <RenameInput
                    initial={group.name}
                    label="Group name"
                    onCommit={arrange.commitRename}
                    onCancel={arrange.cancelRename}
                  />
                ) : (
                  group.name
                )}
                {group.collapsed && <span className="tab-group__count">{entry.count}</span>}
              </div>
            );
          }
          const { tab } = entry;
          const title = tab.title ?? tabTitle(tab, sessions);
          return (
            <TabItem
              key={tab.id}
              tab={tab}
              position={entry.position}
              title={title}
              active={tab.id === workspace.activeTab}
              group={entry.group}
              panes={leafIds(tab.root).length}
              renaming={renaming?.kind === 'tab' && renaming.id === tab.id}
              dragging={drag.state?.tab === tab.id}
              onSelect={() => {
                actions.selectTab(tab.id);
              }}
              onClose={() => {
                actions.closeTab(tab.id);
              }}
              onRename={() => {
                arrange.beginRename({ kind: 'tab', id: tab.id });
              }}
              onCommitRename={arrange.commitRename}
              onCancelRename={arrange.cancelRename}
              onMenu={(event) => {
                setMenu({
                  x: event.clientX,
                  y: event.clientY,
                  entries: tabMenu(tab, {
                    workspace,
                    arrange,
                    windows: props.windows,
                    closeTab: () => {
                      actions.closeTab(tab.id);
                    },
                  }),
                });
              }}
              onPointerDown={(event) => {
                drag.onPointerDown(tab.id, event);
              }}
            />
          );
        })}
        {drag.state !== undefined && !drag.state.tearing && (
          <div
            className="tabs__marker"
            style={{ left: drag.state.marker }}
            data-testid="tab-drop-marker"
          />
        )}
        <button
          type="button"
          className="tabs__new"
          aria-label="New tab"
          title={props.newTabLabel === undefined ? 'New tab' : `New tab (${props.newTabLabel})`}
          onClick={() => {
            actions.runCommand(CommandIds.tabNew);
          }}
        >
          +
        </button>
      </div>
      {menu !== undefined && (
        <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={closeMenu} />
      )}
    </nav>
  );
}
