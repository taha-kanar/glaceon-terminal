import type { PaneId } from '../shared/ids';
import type { Rect } from './pane-layout';
import { containsLeaf, paneLeaf, removeLeaf, splitLeaf, type PaneNode } from './pane-tree';

/** Where a dragged pane lands on a target pane: an edge splits it, the center swaps them. */
export type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center';

/** Share of a pane's size, measured from each edge, that counts as that edge's drop zone. */
const EDGE_BAND = 0.25;

/** The drop zone under `point`; both are in the same coordinate space as `rect`. */
export function dropZoneAt(
  rect: Rect,
  point: { readonly x: number; readonly y: number },
): DropZone {
  const fx = rect.width > 0 ? (point.x - rect.x) / rect.width : 0.5;
  const fy = rect.height > 0 ? (point.y - rect.y) / rect.height : 0.5;
  const distances: readonly (readonly [DropZone, number])[] = [
    ['left', fx],
    ['right', 1 - fx],
    ['top', fy],
    ['bottom', 1 - fy],
  ];
  let best: readonly [DropZone, number] = ['center', EDGE_BAND];
  for (const entry of distances) if (entry[1] < best[1]) best = entry;
  return best[0];
}

/** Exchanges the positions of two leaves. */
export function swapLeaves(tree: PaneNode, a: PaneId, b: PaneId): PaneNode {
  if (tree.kind === 'leaf') {
    if (tree.id === a) return paneLeaf(b);
    if (tree.id === b) return paneLeaf(a);
    return tree;
  }
  const first = swapLeaves(tree.first, a, b);
  const second = swapLeaves(tree.second, a, b);
  return first === tree.first && second === tree.second ? tree : { ...tree, first, second };
}

/** Puts `source` next to (or in place of, for `center`) `target`. Both must be in `tree`. */
export function moveLeaf(
  tree: PaneNode,
  source: PaneId,
  drop: { readonly target: PaneId; readonly zone: DropZone },
): PaneNode {
  const { target, zone } = drop;
  if (source === target || !containsLeaf(tree, source) || !containsLeaf(tree, target)) return tree;
  if (zone === 'center') return swapLeaves(tree, source, target);
  const rest = removeLeaf(tree, source);
  if (rest === undefined) return tree;
  return insertBeside(rest, source, drop);
}

/** Splits `target` so that `pane` (not yet in `tree`) sits on the given side of it. */
export function insertBeside(
  tree: PaneNode,
  pane: PaneId,
  drop: { readonly target: PaneId; readonly zone: DropZone },
): PaneNode {
  const zone = drop.zone === 'center' ? 'right' : drop.zone;
  return splitLeaf(tree, drop.target, {
    newId: pane,
    axis: zone === 'left' || zone === 'right' ? 'row' : 'column',
    placement: zone === 'left' || zone === 'top' ? 'before' : 'after',
  });
}
