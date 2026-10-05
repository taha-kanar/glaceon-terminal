import {
  addTab,
  asPaneId,
  asTabGroupId,
  asTabId,
  createTab,
  EMPTY_WORKSPACE,
  groupTabs,
  patchGroup,
  patchTab,
  type Workspace,
} from '@glaceon/domain';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { fakeActions, fakeArrange } from '../testing/fake-actions';
import { click, render } from '../testing/render';
import { TabBar } from './TabBar';
import { tabBarEntries } from './tab-bar-entries';

const t = (n: number) => asTabId(`t${String(n)}`);
const g = asTabGroupId('g');

function workspace(): Workspace {
  let ws = EMPTY_WORKSPACE;
  for (let i = 1; i <= 4; i++) ws = addTab(ws, createTab(t(i), asPaneId(`p${String(i)}`)));
  ws = patchTab(ws, t(1), { pinned: true, title: 'logs' });
  ws = patchTab(ws, t(2), { locked: true, color: 'red', title: 'server' });
  return groupTabs(ws, [t(3), t(4)], { id: g, name: 'db', color: 'blue' });
}

function renderBar(ws: Workspace, renaming?: { kind: 'tab'; id: ReturnType<typeof t> }) {
  const actions = fakeActions();
  const arrange = fakeArrange();
  const view = render(
    <TabBar
      workspace={ws}
      sessions={new Map()}
      actions={actions}
      arrange={arrange}
      renaming={renaming}
      windows={[
        { id: 1, title: 'Window 1', current: true },
        { id: 2, title: 'Window 2', current: false },
      ]}
      newTabLabel={undefined}
    />,
  );
  return { ...view, actions, arrange };
}

describe('tab bar arrangement', () => {
  it('lists group labels before their tabs and hides collapsed groups but the active tab', () => {
    const ws = workspace();
    expect(
      tabBarEntries(ws).map((e) => (e.kind === 'group' ? `[${e.group.name}]` : e.tab.id)),
    ).toEqual(['t1', 't2', '[db]', 't3', 't4']);
    const collapsed = patchGroup(ws, g, { collapsed: true });
    expect(
      tabBarEntries(collapsed).map((e) => (e.kind === 'group' ? e.count : e.position)),
    ).toEqual([1, 2, 2, 4]);
  });

  it('shows pinned tabs compactly and locked tabs without a close button', () => {
    const { container, unmount } = renderBar(workspace());
    const tabs = container.querySelectorAll<HTMLElement>('[data-testid="tab"]');
    expect(tabs[0]?.querySelector('.tab__title')).toBeNull();
    expect(tabs[0]?.title).toBe('logs');
    expect(tabs[1]?.textContent).toContain('server');
    expect(tabs[1]?.querySelector('.tab__close')).toBeNull();
    expect(tabs[1]?.querySelector('.tab__lock')).not.toBeNull();
    expect(tabs[1]?.dataset['color']).toBe('red');
    unmount();
  });

  it('opens a context menu whose entries call the arrange actions', () => {
    const { container, arrange, unmount } = renderBar(workspace());
    const tab = container.querySelectorAll('[data-testid="tab"]')[2];
    act(() => {
      tab?.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }),
      );
    });
    const items = [...container.querySelectorAll<HTMLButtonElement>('.menu__item')];
    expect(items.map((i) => i.textContent)).toContain('Remove from Group');
    expect(items.map((i) => i.textContent)).toContain('Move to Window 2');
    expect(items.map((i) => i.textContent)).not.toContain('Move to Window 1');
    click(items.find((i) => i.textContent === 'Pin Tab') ?? null);
    expect(arrange.togglePin).toHaveBeenCalledWith(t(3));
    expect(container.querySelector('[data-testid="context-menu"]')).toBeNull();
    act(() => {
      tab?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    });
    click(container.querySelector('[aria-label="green"]'));
    expect(arrange.setColor).toHaveBeenCalledWith(t(3), 'green');
    unmount();
  });

  it('renames inline: Enter commits, Escape cancels', () => {
    const { container, arrange, unmount } = renderBar(workspace(), { kind: 'tab', id: t(2) });
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Tab name"]');
    expect(input?.value).toBe('server');
    if (input === null) throw new Error('no input');
    input.value = 'api';
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(arrange.commitRename).toHaveBeenCalledWith('api');
    unmount();
  });

  it('toggles a group from its label', () => {
    const { container, arrange, unmount } = renderBar(workspace());
    click(container.querySelector('[data-testid="tab-group"]'));
    expect(arrange.toggleGroupCollapsed).toHaveBeenCalledWith(g);
    unmount();
  });
});
