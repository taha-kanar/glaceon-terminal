import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asPaneId } from '../shared/ids';
import { UNIT_RECT } from './pane-layout';
import { dropZoneAt, moveLeaf, swapLeaves } from './pane-moves';
import { leafIds, paneLeaf, paneSplit } from './pane-tree';
import { paneTreeArbitrary } from './pane-tree.arbitrary';

const [a, b, c] = ['a', 'b', 'c'].map(asPaneId) as [
  ReturnType<typeof asPaneId>,
  ReturnType<typeof asPaneId>,
  ReturnType<typeof asPaneId>,
];
const tree = paneSplit('row', {
  first: paneLeaf(a),
  second: paneSplit('column', { first: paneLeaf(b), second: paneLeaf(c) }),
});

describe('dropZoneAt', () => {
  it('picks the nearest edge band and the center otherwise', () => {
    const rect = { x: 0.5, y: 0, width: 0.5, height: 1 };
    expect(dropZoneAt(rect, { x: 0.75, y: 0.5 })).toBe('center');
    expect(dropZoneAt(rect, { x: 0.52, y: 0.5 })).toBe('left');
    expect(dropZoneAt(rect, { x: 0.98, y: 0.5 })).toBe('right');
    expect(dropZoneAt(rect, { x: 0.75, y: 0.05 })).toBe('top');
    expect(dropZoneAt(rect, { x: 0.75, y: 0.95 })).toBe('bottom');
    expect(dropZoneAt({ ...UNIT_RECT, width: 0 }, { x: 0, y: 0.5 })).toBe('center');
  });
});

describe('moveLeaf', () => {
  it('swaps on center and splits the target on an edge', () => {
    expect(leafIds(moveLeaf(tree, a, { target: c, zone: 'center' }))).toEqual([c, b, a]);
    const moved = moveLeaf(tree, c, { target: a, zone: 'top' });
    expect(moved).toEqual(
      paneSplit('row', {
        first: paneSplit('column', { first: paneLeaf(c), second: paneLeaf(a) }),
        second: paneLeaf(b),
      }),
    );
    expect(leafIds(moveLeaf(tree, a, { target: b, zone: 'right' }))).toEqual([b, a, c]);
  });

  it('ignores drops on itself or on unknown panes', () => {
    expect(moveLeaf(tree, a, { target: a, zone: 'left' })).toBe(tree);
    expect(moveLeaf(tree, a, { target: asPaneId('zz'), zone: 'left' })).toBe(tree);
    expect(swapLeaves(tree, asPaneId('x'), asPaneId('y'))).toBe(tree);
  });

  it('keeps every pane exactly once', () => {
    fc.assert(
      fc.property(
        paneTreeArbitrary(),
        fc.record({
          i: fc.nat(),
          j: fc.nat(),
          zone: fc.constantFrom('left', 'right', 'top', 'bottom', 'center' as const),
        }),
        (t, { i, j, zone }) => {
          const ids = leafIds(t);
          const source = ids[i % ids.length];
          const target = ids[j % ids.length];
          if (source === undefined || target === undefined) return;
          const moved = leafIds(moveLeaf(t, source, { target, zone }));
          expect([...moved].sort()).toEqual([...ids].sort());
        },
      ),
    );
  });
});
