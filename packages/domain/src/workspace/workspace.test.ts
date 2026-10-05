import { describe, expect, it } from 'vitest';
import { leafIds } from '../pane/pane-tree';
import { asPaneId, asTabId } from '../shared/ids';
import {
  activateTab,
  activeTab,
  addTab,
  allPaneIds,
  closePane,
  closeTab,
  createTab,
  cycleTab,
  EMPTY_WORKSPACE,
  equalizePanes,
  focusPane,
  moveTab,
  resizePane,
  setSplitRatio,
  splitPane,
  toggleZoom,
  type Workspace,
} from './workspace';

const t1 = asTabId('t1');
const t2 = asTabId('t2');
const t3 = asTabId('t3');
const p = (id: string) => asPaneId(id);

function threeTabs(): Workspace {
  let ws = addTab(EMPTY_WORKSPACE, createTab(t1, p('a')));
  ws = addTab(ws, createTab(t2, p('b')));
  return addTab(ws, createTab(t3, p('c')));
}

describe('workspace tabs', () => {
  it('adds tabs at the end or after a given tab and activates them', () => {
    const ws = threeTabs();
    expect(ws.tabs.map((t) => t.id)).toEqual([t1, t2, t3]);
    expect(ws.activeTab).toBe(t3);
    const inserted = addTab(ws, createTab(asTabId('x'), p('x')), t1);
    expect(inserted.tabs.map((t) => t.id)).toEqual([t1, 'x', t2, t3]);
  });

  it('activates the right neighbour (or left) when closing the active tab', () => {
    const ws = activateTab(threeTabs(), t2);
    expect(closeTab(ws, t2).activeTab).toBe(t3);
    expect(closeTab(threeTabs(), t3).activeTab).toBe(t2);
    expect(closeTab(ws, t1).activeTab).toBe(t2);
    expect(closeTab(closeTab(closeTab(ws, t1), t2), t3)).toEqual(EMPTY_WORKSPACE);
    expect(closeTab(ws, asTabId('nope'))).toBe(ws);
  });

  it('cycles and moves tabs', () => {
    const ws = threeTabs();
    expect(cycleTab(ws, 1).activeTab).toBe(t1);
    expect(cycleTab(ws, -1).activeTab).toBe(t2);
    expect(cycleTab(EMPTY_WORKSPACE, 1)).toBe(EMPTY_WORKSPACE);
    expect(moveTab(ws, t3, 0).tabs.map((t) => t.id)).toEqual([t3, t1, t2]);
    expect(moveTab(ws, t1, 99).tabs.map((t) => t.id)).toEqual([t2, t3, t1]);
    expect(activateTab(ws, asTabId('nope'))).toBe(ws);
  });
});

describe('workspace panes', () => {
  it('splits the pane in its own tab and focuses the new pane', () => {
    const ws = splitPane(threeTabs(), p('b'), { newPane: p('b2'), axis: 'row' });
    const tab = ws.tabs[1];
    expect(tab && leafIds(tab.root)).toEqual([p('b'), p('b2')]);
    expect(tab?.activePane).toBe(p('b2'));
    expect(allPaneIds(ws)).toEqual(['a', 'b', 'b2', 'c']);
  });

  it('focusing a pane activates its tab', () => {
    const ws = focusPane(splitPane(threeTabs(), p('a'), { newPane: p('a2'), axis: 'row' }), p('a'));
    expect(ws.activeTab).toBe(t1);
    expect(activeTab(ws)?.activePane).toBe(p('a'));
  });

  it('closing a pane focuses the previous pane and closes empty tabs', () => {
    let ws = splitPane(threeTabs(), p('c'), { newPane: p('c2'), axis: 'row' });
    ws = splitPane(ws, p('c2'), { newPane: p('c3'), axis: 'column' });
    ws = closePane(ws, p('c3'));
    expect(activeTab(ws)?.activePane).toBe(p('c2'));
    ws = closePane(focusPane(ws, p('c')), p('c'));
    expect(activeTab(ws)?.activePane).toBe(p('c2'));
    ws = closePane(ws, p('c2'));
    expect(ws.tabs.map((t) => t.id)).toEqual([t1, t2]);
    expect(closePane(ws, p('zz'))).toBe(ws);
  });

  it('zoom toggles only when there is more than one pane, and unzooms on split', () => {
    const single = threeTabs();
    expect(toggleZoom(single, t1)).toBe(single);
    const split = splitPane(single, p('a'), { newPane: p('a2'), axis: 'row' });
    const zoomed = toggleZoom(split, t1);
    expect(zoomed.tabs[0]?.zoomed).toBe(true);
    expect(splitPane(zoomed, p('a2'), { newPane: p('a3'), axis: 'row' }).tabs[0]?.zoomed).toBe(
      false,
    );
    expect(closePane(zoomed, p('a')).tabs[0]?.zoomed).toBe(true);
    expect(closePane(zoomed, p('a2')).tabs[0]?.zoomed).toBe(false);
  });

  it('changes split ratios', () => {
    const ws = splitPane(threeTabs(), p('a'), { newPane: p('a2'), axis: 'row' });
    expect(setSplitRatio(ws, t1, { path: [], ratio: 0.25 }).tabs[0]?.root).toMatchObject({
      ratio: 0.25,
    });
    const resized = resizePane(ws, p('a'), { direction: 'left', delta: 0.1 });
    expect(resized.tabs[0]?.root).toMatchObject({ ratio: 0.4 });
    expect(equalizePanes(resized, t1).tabs[0]?.root).toMatchObject({ ratio: 0.5 });
    expect(resizePane(ws, p('zz'), { direction: 'left', delta: 0.1 })).toBe(ws);
  });
});
