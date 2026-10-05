import fc from 'fast-check';
import { asPaneId, type PaneId } from '../shared/ids';
import { paneLeaf, paneSplit, type PaneNode } from './pane-tree';

/** Random pane trees with unique leaf ids (test-only helper). */
export function paneTreeArbitrary(maxDepth = 5): fc.Arbitrary<PaneNode> {
  let counter = 0;
  const nextId = (): PaneId => asPaneId(`p${String(counter++)}`);
  const { tree } = fc.letrec<{ tree: PaneNode }>((tie) => ({
    tree: fc.oneof(
      { maxDepth, depthIdentifier: 'tree' },
      fc.constant(null).map(() => paneLeaf(nextId())),
      fc
        .record({
          axis: fc.constantFrom('row' as const, 'column' as const),
          ratio: fc.double({ min: 0.05, max: 0.95, noNaN: true }),
          first: tie('tree'),
          second: tie('tree'),
        })
        .map(({ axis, ratio, first, second }) => paneSplit(axis, { first, second }, ratio)),
    ),
  }));
  return tree;
}
