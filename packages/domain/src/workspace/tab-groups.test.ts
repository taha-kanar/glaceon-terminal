import { describe, expect, it } from 'vitest';
import { asPaneId, asTabGroupId, asTabId, type TabId } from '../shared/ids';
import { groupTabs, moveTab, patchGroup, patchTab, setTabGroup, ungroup } from './tab-groups';
import { addTab, closeTab, createTab, EMPTY_WORKSPACE, type Workspace } from './workspace';

const t = (n: number) => asTabId(`t${String(n)}`);
const g1 = asTabGroupId('g1');
const order = (ws: Workspace) => ws.tabs.map((tab) => tab.id);

function tabs(n: number): Workspace {
  let ws = EMPTY_WORKSPACE;
  for (let i = 1; i <= n; i++) ws = addTab(ws, createTab(t(i), asPaneId(`p${String(i)}`)));
  return ws;
}

const grouped = (ws: Workspace, ids: TabId[]) =>
  groupTabs(ws, ids, { id: g1, name: 'api', color: 'blue' });

describe('tab metadata', () => {
  it('renames, trims and clears titles', () => {
    let ws = patchTab(tabs(1), t(1), { title: '  build ' });
    expect(ws.tabs[0]?.title).toBe('build');
    ws = patchTab(ws, t(1), { title: '   ' });
    expect(ws.tabs[0]?.title).toBeUndefined();
    expect(patchTab(ws, t(1), { color: 'red', locked: true }).tabs[0]).toMatchObject({
      color: 'red',
      locked: true,
    });
  });

  it('keeps pinned tabs in front', () => {
    const ws = patchTab(patchTab(tabs(4), t(3), { pinned: true }), t(4), { pinned: true });
    expect(order(ws)).toEqual([t(3), t(4), t(1), t(2)]);
    expect(order(patchTab(ws, t(3), { pinned: false }))).toEqual([t(4), t(3), t(1), t(2)]);
  });
});

describe('groups', () => {
  it('gathers group members next to the first one', () => {
    const ws = grouped(tabs(4), [t(1), t(3)]);
    expect(order(ws)).toEqual([t(1), t(3), t(2), t(4)]);
    expect(ws.groups).toEqual([{ id: g1, name: 'api', color: 'blue', collapsed: false }]);
  });

  it('new tabs opened from a grouped tab join the group', () => {
    const ws = addTab(grouped(tabs(2), [t(1)]), createTab(t(9), asPaneId('p9')), t(1));
    expect(ws.tabs.find((tab) => tab.id === t(9))?.group).toBe(g1);
  });

  it('drops groups that lose their last tab', () => {
    const ws = grouped(tabs(2), [t(1)]);
    expect(closeTab(ws, t(1)).groups).toEqual([]);
    expect(setTabGroup(ws, t(1), undefined).groups).toEqual([]);
    expect(ungroup(ws, g1).tabs.every((tab) => tab.group === undefined)).toBe(true);
    expect(patchTab(ws, t(1), { pinned: true }).groups).toEqual([]);
  });

  it('renames and collapses groups', () => {
    const ws = patchGroup(grouped(tabs(1), [t(1)]), g1, { name: ' web ', collapsed: true });
    expect(ws.groups[0]).toMatchObject({ name: 'web', collapsed: true });
    expect(patchGroup(ws, g1, { name: '' })).toBe(ws);
    expect(setTabGroup(ws, t(1), asTabGroupId('missing'))).toBe(ws);
  });
});

describe('moveTab', () => {
  it('joins a group when dropped inside it and leaves when dropped outside', () => {
    const ws = grouped(tabs(4), [t(2), t(3)]);
    const joined = moveTab(ws, t(1), 1);
    expect(order(joined)).toEqual([t(2), t(1), t(3), t(4)]);
    expect(joined.tabs[1]?.group).toBe(g1);
    const left = moveTab(ws, t(2), 3);
    expect(order(left)).toEqual([t(1), t(3), t(4), t(2)]);
    expect(left.tabs[3]?.group).toBeUndefined();
  });

  it('pins tabs dropped among pinned ones', () => {
    const ws = patchTab(tabs(3), t(1), { pinned: true });
    expect(moveTab(ws, t(3), 0).tabs[0]).toMatchObject({ id: t(3), pinned: true });
    expect(moveTab(ws, t(1), 2).tabs.at(-1)).toMatchObject({ id: t(1), pinned: false });
    expect(moveTab(ws, asTabId('nope'), 0)).toBe(ws);
  });
});
