import {
  asPaneId,
  asTabId,
  CommandIds,
  createTab,
  splitPane,
  addTab,
  EMPTY_WORKSPACE,
} from '@glaceon/domain';
import type { SessionInfo } from '@glaceon/application';
import { describe, expect, it } from 'vitest';
import { fakeActions, fakeArrange } from '../testing/fake-actions';
import { click, render } from '../testing/render';
import { TabBar } from './TabBar';
import { tabTitle } from './tab-title';

const a = asPaneId('a');
const b = asPaneId('b');
let workspace = addTab(EMPTY_WORKSPACE, createTab(asTabId('t1'), a));
workspace = addTab(workspace, createTab(asTabId('t2'), b));
workspace = splitPane(workspace, b, { newPane: asPaneId('b2'), axis: 'row' });

describe('TabBar', () => {
  it('renders tabs with titles, the active marker and pane counts', () => {
    const sessions = new Map<ReturnType<typeof asPaneId>, SessionInfo>([
      [a, { shell: 'zsh', process: 'vim' }],
    ]);
    const { container, unmount } = render(
      <TabBar
        workspace={workspace}
        sessions={sessions}
        actions={fakeActions()}
        arrange={fakeArrange()}
        renaming={undefined}
        newTabLabel="⌘T"
      />,
    );
    const tabs = container.querySelectorAll('[data-testid="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.textContent).toContain('vim');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.querySelector('.tab__badge')?.textContent).toBe('2');
    expect(container.querySelector('.tabs__new')?.getAttribute('title')).toBe('New tab (⌘T)');
    unmount();
  });

  it('reports selection, closing and new tab clicks', () => {
    const actions = fakeActions();
    const { container, unmount } = render(
      <TabBar
        workspace={workspace}
        sessions={new Map()}
        actions={actions}
        arrange={fakeArrange()}
        renaming={undefined}
        newTabLabel={undefined}
      />,
    );
    click(container.querySelector('[data-testid="tab"]'));
    expect(actions.selectTab).toHaveBeenCalledWith('t1');
    click(container.querySelector('.tab__close'));
    expect(actions.closeTab).toHaveBeenCalledWith('t1');
    click(container.querySelector('.tabs__new'));
    expect(actions.runCommand).toHaveBeenCalledWith(CommandIds.tabNew);
    unmount();
  });

  it('names exited sessions', () => {
    const tab = workspace.tabs[0]!;
    expect(tabTitle(tab, new Map([[a, { shell: 'zsh', exit: { exitCode: 1 } }]]))).toBe(
      'zsh (exited)',
    );
    expect(tabTitle(tab, new Map())).toBe('shell');
  });
});
