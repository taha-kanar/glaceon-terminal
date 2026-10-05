import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asPaneId } from '../shared/ids';
import { findLayout, LAYOUT_TEMPLATES, layoutSlots } from './layout-templates';
import { computeLayout } from './pane-layout';
import { leafIds } from './pane-tree';

const ids = (n: number) => Array.from({ length: n }, (_, i) => asPaneId(`p${String(i)}`));

describe('layout templates', () => {
  it('keep panes in reading order and tile the whole area', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LAYOUT_TEMPLATES),
        fc.integer({ min: 1, max: 9 }),
        (layout, n) => {
          const panes = ids(layout.slots ?? n);
          const tree = layout.build(panes);
          expect(leafIds(tree)).toEqual(panes);
          const area = computeLayout(tree).panes.reduce(
            (sum, p) => sum + p.rect.width * p.rect.height,
            0,
          );
          expect(area).toBeCloseTo(1, 9);
        },
      ),
    );
  });

  it('builds equal grids', () => {
    const grid = findLayout('grid-2x2');
    if (grid === undefined) throw new Error('missing layout');
    const rects = computeLayout(grid.build(ids(4))).panes.map((p) => p.rect);
    expect(rects.map((r) => [r.x, r.y, r.width, r.height])).toEqual([
      [0, 0, 0.5, 0.5],
      [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ]);
    const adaptive = findLayout('grid');
    expect(adaptive && computeLayout(adaptive.build(ids(3))).panes[2]?.rect.width).toBe(1);
  });

  it('reports how many panes a layout needs', () => {
    const grid = findLayout('grid-2x2');
    const rows = findLayout('rows');
    if (grid === undefined || rows === undefined) throw new Error('missing layout');
    expect(layoutSlots(grid, 3)).toBe(4);
    expect(layoutSlots(grid, 5)).toBeUndefined();
    expect(layoutSlots(rows, 5)).toBe(5);
    expect(findLayout('nope')).toBeUndefined();
  });
});
