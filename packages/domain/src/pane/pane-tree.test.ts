import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asPaneId } from '../shared/ids';
import { paneTreeArbitrary } from './pane-tree.arbitrary';
import {
  containsLeaf,
  equalize,
  leafIds,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  nodeAt,
  paneLeaf,
  paneSplit,
  removeLeaf,
  resizeLeaf,
  setRatioAt,
  splitLeaf,
} from './pane-tree';

const a = asPaneId('a');
const b = asPaneId('b');
const c = asPaneId('c');
const fresh = asPaneId('fresh');

describe('pane tree', () => {
  it('splits a leaf after or before the target', () => {
    const tree = splitLeaf(paneLeaf(a), a, { newId: b, axis: 'row' });
    expect(tree).toEqual(paneSplit('row', { first: paneLeaf(a), second: paneLeaf(b) }));
    const before = splitLeaf(paneLeaf(a), a, { newId: b, axis: 'column', placement: 'before' });
    expect(leafIds(before)).toEqual([b, a]);
  });

  it('returns the same tree when the target does not exist', () => {
    const tree = paneLeaf(a);
    expect(splitLeaf(tree, b, { newId: c, axis: 'row' })).toBe(tree);
    expect(removeLeaf(tree, b)).toBe(tree);
  });

  it('removing the last leaf leaves nothing', () => {
    expect(removeLeaf(paneLeaf(a), a)).toBeUndefined();
  });

  it('split followed by remove restores the original tree', () => {
    fc.assert(
      fc.property(paneTreeArbitrary(), fc.nat(), fc.boolean(), (tree, pick, row) => {
        const ids = leafIds(tree);
        const target = ids[pick % ids.length];
        if (target === undefined) return;
        const split = splitLeaf(tree, target, { newId: fresh, axis: row ? 'row' : 'column' });
        expect(leafIds(split)).toHaveLength(ids.length + 1);
        expect(removeLeaf(split, fresh)).toEqual(tree);
      }),
    );
  });

  it('removing a leaf keeps every other leaf in order', () => {
    fc.assert(
      fc.property(paneTreeArbitrary(), fc.nat(), (tree, pick) => {
        const ids = leafIds(tree);
        const target = ids[pick % ids.length];
        if (target === undefined) return;
        const rest = removeLeaf(tree, target);
        expect(rest === undefined ? [] : leafIds(rest)).toEqual(ids.filter((id) => id !== target));
      }),
    );
  });

  it('clamps ratios and addresses splits by path', () => {
    const tree = paneSplit('row', {
      first: paneLeaf(a),
      second: paneSplit('column', { first: paneLeaf(b), second: paneLeaf(c) }),
    });
    const changed = setRatioAt(tree, ['second'], 2);
    const inner = nodeAt(changed, ['second']);
    expect(inner?.kind === 'split' && inner.ratio).toBe(MAX_SPLIT_RATIO);
    expect(nodeAt(changed, ['first', 'first'])).toBeUndefined();
    expect(setRatioAt(tree, [], -1)).toMatchObject({ ratio: MIN_SPLIT_RATIO });
    expect(paneSplit('row', { first: paneLeaf(a), second: paneLeaf(b) }, Number.NaN).ratio).toBe(
      0.5,
    );
    expect(containsLeaf(tree, c)).toBe(true);
  });

  it('equalize gives each pane in a same-axis run an equal share', () => {
    const tree = paneSplit(
      'row',
      {
        first: paneLeaf(a),
        second: paneSplit('row', { first: paneLeaf(b), second: paneLeaf(c) }, 0.9),
      },
      0.9,
    );
    const equal = equalize(tree);
    expect(equal).toMatchObject({ ratio: 1 / 3, second: { ratio: 0.5 } });
  });

  it('resizes the nearest split along the direction axis', () => {
    const tree = paneSplit('row', {
      first: paneLeaf(a),
      second: paneSplit('column', { first: paneLeaf(b), second: paneLeaf(c) }),
    });
    expect(resizeLeaf(tree, b, { direction: 'right', delta: 0.1 })).toMatchObject({ ratio: 0.6 });
    expect(resizeLeaf(tree, b, { direction: 'up', delta: 0.1 })).toMatchObject({
      second: { ratio: 0.4 },
    });
    expect(resizeLeaf(paneLeaf(a), a, { direction: 'left', delta: 0.1 })).toEqual(paneLeaf(a));
  });
});
