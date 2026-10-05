import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asPaneId } from '../shared/ids';
import { computeLayout, navigate, ratioFromPointer, type Rect } from './pane-layout';
import { paneTreeArbitrary } from './pane-tree.arbitrary';
import { leafIds, paneLeaf, paneSplit } from './pane-tree';

const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(asPaneId) as [
  ReturnType<typeof asPaneId>,
  ReturnType<typeof asPaneId>,
  ReturnType<typeof asPaneId>,
  ReturnType<typeof asPaneId>,
];

function intersection(r: Rect, s: Rect): number {
  const w = Math.min(r.x + r.width, s.x + s.width) - Math.max(r.x, s.x);
  const h = Math.min(r.y + r.height, s.y + s.height) - Math.max(r.y, s.y);
  return w > 0 && h > 0 ? w * h : 0;
}

describe('computeLayout', () => {
  it('tiles the unit square without gaps or overlaps', () => {
    fc.assert(
      fc.property(paneTreeArbitrary(), (tree) => {
        const { panes, dividers } = computeLayout(tree);
        expect(panes.map((p) => p.id)).toEqual(leafIds(tree));
        expect(dividers).toHaveLength(panes.length - 1);
        const area = panes.reduce((sum, p) => sum + p.rect.width * p.rect.height, 0);
        expect(area).toBeCloseTo(1, 9);
        for (const [i, p] of panes.entries()) {
          for (const q of panes.slice(i + 1))
            expect(intersection(p.rect, q.rect)).toBeCloseTo(0, 9);
        }
      }),
    );
  });

  it('converts pointer positions on a divider back to its ratio', () => {
    const tree = paneSplit('column', { first: paneLeaf(a), second: paneLeaf(b) }, 0.3);
    const [divider] = computeLayout(tree).dividers;
    if (divider === undefined) throw new Error('expected a divider');
    expect(divider.position).toBeCloseTo(0.3);
    expect(ratioFromPointer(divider, { x: 0.5, y: 0.75 })).toBeCloseTo(0.75);
  });
});

describe('navigate', () => {
  // a | b
  // c | d   (c spans under a, d under b)
  const grid = paneSplit('row', {
    first: paneSplit('column', { first: paneLeaf(a), second: paneLeaf(c) }),
    second: paneSplit('column', { first: paneLeaf(b), second: paneLeaf(d) }),
  });
  const layout = computeLayout(grid);

  it('moves to the adjacent pane in each direction', () => {
    expect(navigate(layout, a, 'right')).toBe(b);
    expect(navigate(layout, a, 'down')).toBe(c);
    expect(navigate(layout, d, 'left')).toBe(c);
    expect(navigate(layout, d, 'up')).toBe(b);
  });

  it('returns undefined at the edges and for unknown panes', () => {
    expect(navigate(layout, a, 'left')).toBeUndefined();
    expect(navigate(layout, a, 'up')).toBeUndefined();
    expect(navigate(layout, asPaneId('zz'), 'up')).toBeUndefined();
  });

  it('prefers the pane sharing the longest edge', () => {
    // a spans the full height on the left; b (70%) and c (30%) on the right.
    const tree = paneSplit('row', {
      first: paneLeaf(a),
      second: paneSplit('column', { first: paneLeaf(b), second: paneLeaf(c) }, 0.7),
    });
    expect(navigate(computeLayout(tree), a, 'right')).toBe(b);
  });

  it('always lands on an existing pane that lies in the requested direction', () => {
    fc.assert(
      fc.property(
        paneTreeArbitrary(),
        fc.nat(),
        fc.constantFrom('left' as const, 'right' as const, 'up' as const, 'down' as const),
        (tree, pick, direction) => {
          const l = computeLayout(tree);
          const from = l.panes[pick % l.panes.length];
          if (from === undefined) return;
          const target = navigate(l, from.id, direction);
          if (target === undefined) return;
          const to = l.panes.find((p) => p.id === target)?.rect;
          if (to === undefined) throw new Error('navigate returned an unknown pane');
          const f = from.rect;
          const ok = {
            left: to.x + to.width <= f.x + 1e-9,
            right: to.x >= f.x + f.width - 1e-9,
            up: to.y + to.height <= f.y + 1e-9,
            down: to.y >= f.y + f.height - 1e-9,
          }[direction];
          expect(ok).toBe(true);
        },
      ),
    );
  });
});
