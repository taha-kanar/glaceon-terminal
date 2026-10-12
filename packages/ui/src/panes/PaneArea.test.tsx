import {
  addTab,
  asPaneId,
  asTabId,
  createTab,
  EMPTY_WORKSPACE,
  splitPane,
  toggleZoom,
} from '@glaceon/domain';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fakeActions, fakeArrange } from '../testing/fake-actions';
import { click, render } from '../testing/render';
import { PaneArea } from './PaneArea';

const a = asPaneId('a');
const b = asPaneId('b');
const c = asPaneId('c');
let workspace = addTab(EMPTY_WORKSPACE, createTab(asTabId('t1'), a));
workspace = splitPane(workspace, a, { newPane: b, axis: 'row' });
workspace = addTab(workspace, createTab(asTabId('t2'), c), asTabId('t1'));
workspace = { ...workspace, activeTab: asTabId('t1') };

/** Fires a drag event carrying what another app would put on the drag. */
function drag(
  target: Element | null,
  type: string,
  data: { readonly files?: readonly File[]; readonly text?: string },
): boolean {
  if (target === null) throw new Error('element not found');
  const files = data.files ?? [];
  const types = [
    ...(files.length > 0 ? ['Files'] : []),
    ...(data.text === undefined ? [] : ['text/plain']),
  ];
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types, files, dropEffect: 'none', getData: () => data.text ?? '' },
  });
  let notCancelled = true;
  act(() => {
    notCancelled = target.dispatchEvent(event);
  });
  return notCancelled;
}

describe('PaneArea', () => {
  it('renders every pane of every tab, hiding inactive tabs, and binds each slot once', () => {
    const detach = vi.fn();
    const bindSlot = vi.fn(() => detach);
    const { container, unmount } = render(
      <PaneArea
        workspace={workspace}
        sessions={new Map()}
        actions={fakeActions()}
        arrange={fakeArrange()}
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
        arrange={fakeArrange()}
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
        arrange={fakeArrange()}
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

  it('highlights a pane while files are dragged over it and reports the drop', () => {
    const actions = fakeActions();
    const { container, unmount } = render(
      <PaneArea
        workspace={workspace}
        sessions={new Map()}
        actions={actions}
        arrange={fakeArrange()}
        bindSlot={() => () => undefined}
      />,
    );
    const pane = container.querySelector('[data-pane="b"]');
    const file = new File(['x'], 'report.pdf');
    expect(drag(pane, 'dragenter', { files: [file] })).toBe(false);
    expect(drag(pane, 'dragover', { files: [file] })).toBe(false);
    expect(pane?.classList.contains('pane--file-drop')).toBe(true);
    drag(pane, 'drop', { files: [file], text: '' });
    expect(pane?.classList.contains('pane--file-drop')).toBe(false);
    expect(actions.dropOnPane).toHaveBeenCalledWith('b', { files: [file], text: '' });
    unmount();
  });

  it('ignores drags it cannot use and drops on exited panes', () => {
    const actions = fakeActions();
    const { container, unmount } = render(
      <PaneArea
        workspace={workspace}
        sessions={new Map([[b, { exit: { exitCode: 0 } }]])}
        actions={actions}
        arrange={fakeArrange()}
        bindSlot={() => () => undefined}
      />,
    );
    expect(drag(container.querySelector('[data-pane="a"]'), 'dragover', {})).toBe(true);
    const exited = container.querySelector('[data-pane="b"]');
    expect(drag(exited, 'dragenter', { text: 'ls' })).toBe(true);
    drag(exited, 'drop', { text: 'ls' });
    expect(exited?.classList.contains('pane--file-drop')).toBe(false);
    expect(actions.dropOnPane).not.toHaveBeenCalled();
    unmount();
  });
});
