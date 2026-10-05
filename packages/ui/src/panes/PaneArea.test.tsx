import {
  addTab,
  asPaneId,
  asTabId,
  createTab,
  EMPTY_WORKSPACE,
  splitPane,
  toggleZoom,
} from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { fakeActions } from '../testing/fake-actions';
import { click, render } from '../testing/render';
import { PaneArea } from './PaneArea';

const a = asPaneId('a');
const b = asPaneId('b');
const c = asPaneId('c');
let workspace = addTab(EMPTY_WORKSPACE, createTab(asTabId('t1'), a));
workspace = splitPane(workspace, a, { newPane: b, axis: 'row' });
workspace = addTab(workspace, createTab(asTabId('t2'), c), asTabId('t1'));
workspace = { ...workspace, activeTab: asTabId('t1') };

describe('PaneArea', () => {
  it('renders every pane of every tab, hiding inactive tabs, and binds each slot once', () => {
    const detach = vi.fn();
    const bindSlot = vi.fn(() => detach);
    const { container, unmount } = render(
      <PaneArea
        workspace={workspace}
        sessions={new Map()}
        actions={fakeActions()}
        bindSlot={bindSlot}
      />,
    );
    const panes = [...container.querySelectorAll<HTMLElement>('[data-testid="pane"]')];
    expect(panes.map((p) => p.dataset['pane'])).toEqual(['a', 'b', 'c']);
    expect(panes[2]?.classList.contains('pane--hidden')).toBe(true);
    expect(panes[0]?.style.width).toBe('50%');
    expect(panes[1]?.dataset['focused']).toBe('true');
    expect(panes[0]?.classList.contains('pane--dimmed')).toBe(true);
    expect(container.querySelectorAll('[data-testid="divider"]')).toHaveLength(1);
    expect(bindSlot).toHaveBeenCalledTimes(3);
    unmount();
    expect(detach).toHaveBeenCalledTimes(3);
  });

  it('gives a zoomed pane the whole area and hides dividers', () => {
    const zoomed = toggleZoom(workspace, asTabId('t1'));
    const { container, unmount } = render(
      <PaneArea
        workspace={zoomed}
        sessions={new Map()}
        actions={fakeActions()}
        bindSlot={() => () => undefined}
      />,
    );
    const panes = container.querySelectorAll<HTMLElement>('[data-testid="pane"]');
    expect(panes[1]?.style.width).toBe('100%');
    expect(panes[0]?.classList.contains('pane--hidden')).toBe(true);
    expect(container.querySelectorAll('[data-testid="divider"]')).toHaveLength(0);
    unmount();
  });

  it('shows the exit overlay and focuses panes on click', () => {
    const actions = fakeActions();
    const { container, unmount } = render(
      <PaneArea
        workspace={workspace}
        sessions={new Map([[b, { exit: { exitCode: 2 } }]])}
        actions={actions}
        bindSlot={() => () => undefined}
      />,
    );
    expect(container.querySelector('[data-testid="exit-overlay"]')?.textContent).toContain(
      'code 2',
    );
    click(container.querySelector('.button--primary'));
    expect(actions.restartPane).toHaveBeenCalledWith('b');
    click(container.querySelector('[data-pane="a"]'));
    expect(actions.focusPane).toHaveBeenCalledWith('a');
    unmount();
  });
});
