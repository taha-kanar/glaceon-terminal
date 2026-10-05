import type { PaneId } from '../shared/ids';

/** `row` places children side by side (left | right); `column` stacks them (top / bottom). */
export type SplitAxis = 'row' | 'column';

export interface PaneLeaf {
  readonly kind: 'leaf';
  readonly id: PaneId;
}

export interface PaneSplit {
  readonly kind: 'split';
  readonly axis: SplitAxis;
  /** Share of the space given to `first`, in (0, 1). */
  readonly ratio: number;
  readonly first: PaneNode;
  readonly second: PaneNode;
}

/** An immutable binary tree of panes. Every operation returns a new tree. */
export type PaneNode = PaneLeaf | PaneSplit;

export type SplitBranch = 'first' | 'second';
/** Address of a split node: the branches taken from the root. */
export type SplitPath = readonly SplitBranch[];

export const MIN_SPLIT_RATIO = 0.05;
export const MAX_SPLIT_RATIO = 1 - MIN_SPLIT_RATIO;

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

export function paneLeaf(id: PaneId): PaneLeaf {
  return { kind: 'leaf', id };
}

export function paneSplit(
  axis: SplitAxis,
  children: { readonly first: PaneNode; readonly second: PaneNode },
  ratio = 0.5,
): PaneSplit {
  return { kind: 'split', axis, ratio: clampRatio(ratio), ...children };
}

/** Leaf ids in reading order (depth first, first before second). */
export function leafIds(tree: PaneNode): PaneId[] {
  return tree.kind === 'leaf' ? [tree.id] : [...leafIds(tree.first), ...leafIds(tree.second)];
}

export function containsLeaf(tree: PaneNode, id: PaneId): boolean {
  return tree.kind === 'leaf'
    ? tree.id === id
    : containsLeaf(tree.first, id) || containsLeaf(tree.second, id);
}

export function nodeAt(tree: PaneNode, path: SplitPath): PaneNode | undefined {
  let node: PaneNode = tree;
  for (const branch of path) {
    if (node.kind === 'leaf') return undefined;
    node = node[branch];
  }
  return node;
}

/** Replaces every leaf for which `replace` returns a node. */
function mapLeaves(tree: PaneNode, replace: (leaf: PaneLeaf) => PaneNode | undefined): PaneNode {
  if (tree.kind === 'leaf') return replace(tree) ?? tree;
  const first = mapLeaves(tree.first, replace);
  const second = mapLeaves(tree.second, replace);
  return first === tree.first && second === tree.second ? tree : { ...tree, first, second };
}

export interface SplitLeafOptions {
  readonly newId: PaneId;
  readonly axis: SplitAxis;
  /** Whether the new pane goes after (right/below) or before (left/above) the target. */
  readonly placement?: 'after' | 'before';
}

/** Splits `target` in two. Returns the tree unchanged when `target` is not in it. */
export function splitLeaf(tree: PaneNode, target: PaneId, options: SplitLeafOptions): PaneNode {
  return mapLeaves(tree, (leaf) => {
    if (leaf.id !== target) return undefined;
    const created = paneLeaf(options.newId);
    return options.placement === 'before'
      ? paneSplit(options.axis, { first: created, second: leaf })
      : paneSplit(options.axis, { first: leaf, second: created });
  });
}

/** Removes a leaf; its sibling takes the parent's place. Removing the last leaf yields undefined. */
export function removeLeaf(tree: PaneNode, id: PaneId): PaneNode | undefined {
  if (tree.kind === 'leaf') return tree.id === id ? undefined : tree;
  const first = removeLeaf(tree.first, id);
  const second = removeLeaf(tree.second, id);
  if (first === undefined) return second;
  if (second === undefined) return first;
  return first === tree.first && second === tree.second ? tree : { ...tree, first, second };
}

export function setRatioAt(tree: PaneNode, path: SplitPath, ratio: number): PaneNode {
  if (tree.kind === 'leaf') return tree;
  const [branch, ...rest] = path;
  if (branch === undefined) return { ...tree, ratio: clampRatio(ratio) };
  return { ...tree, [branch]: setRatioAt(tree[branch], rest, ratio) };
}

/** Number of equal slots a node occupies along `axis`. */
function slotsAlong(node: PaneNode, axis: SplitAxis): number {
  if (node.kind === 'leaf' || node.axis !== axis) return 1;
  return slotsAlong(node.first, axis) + slotsAlong(node.second, axis);
}

/** Gives every pane in a run of same-axis splits an equal share. */
export function equalize(tree: PaneNode): PaneNode {
  if (tree.kind === 'leaf') return tree;
  const first = slotsAlong(tree.first, tree.axis);
  const second = slotsAlong(tree.second, tree.axis);
  return {
    ...tree,
    ratio: clampRatio(first / (first + second)),
    first: equalize(tree.first),
    second: equalize(tree.second),
  };
}

/** Path to the leaf's nearest ancestor split with the given axis, or undefined. */
function ancestorPath(tree: PaneNode, id: PaneId, axis: SplitAxis): SplitPath | undefined {
  const walk = (node: PaneNode, path: SplitBranch[]): SplitBranch[] | null | undefined => {
    if (node.kind === 'leaf') return node.id === id ? null : undefined;
    for (const branch of ['first', 'second'] as const) {
      const found = walk(node[branch], [...path, branch]);
      if (found === null) return node.axis === axis ? path : null;
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const found = walk(tree, []);
  return found ?? undefined;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/** Moves the divider nearest to `id` in `direction` by `delta` (a share of the split's size). */
export function resizeLeaf(
  tree: PaneNode,
  id: PaneId,
  move: { readonly direction: Direction; readonly delta: number },
): PaneNode {
  const axis: SplitAxis =
    move.direction === 'left' || move.direction === 'right' ? 'row' : 'column';
  const path = ancestorPath(tree, id, axis);
  if (path === undefined) return tree;
  const split = nodeAt(tree, path);
  if (split?.kind !== 'split') return tree;
  const sign = move.direction === 'right' || move.direction === 'down' ? 1 : -1;
  return setRatioAt(tree, path, split.ratio + sign * move.delta);
}
