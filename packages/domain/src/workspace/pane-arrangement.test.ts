import { describe, expect, it } from 'vitest';
import { findLayout } from '../pane/layout-templates';
import { leafIds } from '../pane/pane-tree';
import { asPaneId, asTabId } from '../shared/ids';
import { applyLayout, movePane, paneToNewTab, paneToTab } from './pane-arrangement';
import {
  activeTab,
  addTab,
  createTab,
  EMPTY_WORKSPACE,
  splitPane,
  type Workspace,
} from './workspace';

const p = (id: string) => asPaneId(id);
const t1 = asTabId('t1');
const t2 = asTabId('t2');

/** t1: a | b | c, t2: d */
function workspace(): Workspace {
  let ws = addTab(EMPTY_WORKSPACE, createTab(t1, p('a')));
  ws = splitPane(ws, p('a'), { newPane: p('b'), axis: 'row' });
  ws = splitPane(ws, p('b'), { newPane: p('c'), axis: 'row' });
  return addTab(ws, createTab(t2, p('d')));
}

const panesOf = (ws: Workspace, i: number) => {
  const tab = ws.tabs[i];
  return tab === undefined ? [] : leafIds(tab.root);
};

describe('movePane', () => {
  it('rearranges panes within a tab and focuses the moved one', () => {
    const ws = movePane(workspace(), p('a'), { target: p('c'), zone: 'center' });
    expect(panesOf(ws, 0)).toEqual([p('c'), p('b'), p('a')]);
    expect(activeTab(ws)?.activePane).toBe(p('a'));
  });

  it('moves panes across tabs, closing a tab left empty', () => {
    const ws = movePane(workspace(), p('d'), { target: p('a'), zone: 'left' });
    expect(ws.tabs).toHaveLength(1);
    expect(panesOf(ws, 0)).toEqual([p('d'), p('a'), p('b'), p('c')]);
    const swapAcross = movePane(workspace(), p('d'), { target: p('a'), zone: 'center' });
    expect(panesOf(swapAcross, 1)).toEqual([p('d')]);
  });

  it('breaks a pane out into its own tab and back', () => {
    const ws = paneToNewTab(workspace(), p('b'), asTabId('t3'));
    expect(ws.tabs.map((tab) => tab.id)).toEqual([t1, asTabId('t3'), t2]);
    expect(activeTab(ws)?.activePane).toBe(p('b'));
    expect(paneToNewTab(ws, p('d'), asTabId('t4'))).toBe(ws);
    const back = paneToTab(ws, p('b'), t2);
    expect(panesOf(back, 1)).toEqual([p('d'), p('b')]);
    expect(back.activeTab).toBe(t2);
  });
});

describe('applyLayout', () => {
  it('keeps every existing pane and fills extra slots with new ones', () => {
    const template = findLayout('grid-2x2');
    if (template === undefined) throw new Error('missing layout');
    const ws = applyLayout(workspace(), t1, { template, newPanes: [p('n1'), p('n2')] });
    expect(panesOf(ws, 0)).toEqual([p('a'), p('b'), p('c'), p('n1')]);
  });

  it('refuses layouts with too few slots or missing new panes', () => {
    const template = findLayout('grid-2x2');
    if (template === undefined) throw new Error('missing layout');
    let ws = workspace();
    ws = splitPane(ws, p('a'), { newPane: p('x'), axis: 'row' });
    ws = splitPane(ws, p('a'), { newPane: p('y'), axis: 'row' });
    expect(applyLayout(ws, t1, { template, newPanes: [] })).toBe(ws);
    const three = workspace();
    expect(applyLayout(three, t1, { template, newPanes: [] })).toBe(three);
  });
});
