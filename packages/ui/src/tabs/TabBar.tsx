import { CommandIds, leafIds, type Workspace } from '@glaceon/domain';
import type { SessionInfoMap } from '@glaceon/application';
import type { ReactElement } from 'react';
import type { AppActions } from '../app/app-model';
import { tabTitle } from './tab-title';

export interface TabBarProps {
  readonly workspace: Workspace;
  readonly sessions: SessionInfoMap;
  readonly actions: AppActions;
  readonly newTabLabel: string | undefined;
}

export function TabBar({ workspace, sessions, actions, newTabLabel }: TabBarProps): ReactElement {
  return (
    <header className="titlebar">
      <div className="tabs" role="tablist">
        {workspace.tabs.map((tab, index) => {
          const active = tab.id === workspace.activeTab;
          const panes = leafIds(tab.root).length;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              className={active ? 'tab tab--active' : 'tab'}
              data-testid="tab"
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  actions.closeTab(tab.id);
                } else if (event.button === 0) {
                  actions.selectTab(tab.id);
                }
              }}
            >
              {index < 9 && <span className="tab__index">{index + 1}</span>}
              <span className="tab__title">{tabTitle(tab, sessions)}</span>
              {panes > 1 && <span className="tab__badge">{panes}</span>}
              <button
                type="button"
                className="tab__close"
                aria-label="Close tab"
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  actions.closeTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="tabs__new"
          aria-label="New tab"
          title={newTabLabel === undefined ? 'New tab' : `New tab (${newTabLabel})`}
          onClick={() => {
            actions.runCommand(CommandIds.tabNew);
          }}
        >
          +
        </button>
      </div>
    </header>
  );
}
