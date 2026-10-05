import type { PaneId } from '../shared/ids';
import type { Direction, PaneNode, SplitAxis, SplitBranch, SplitPath } from './pane-tree';

/** A rectangle in unit coordinates: the whole tab is { 0, 0, 1, 1 }. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const UNIT_RECT: Rect = { x: 0, y: 0, width: 1, height: 1 };

export interface PaneRect {
  readonly id: PaneId;
  readonly rect: Rect;
}

export interface DividerRect {
  readonly path: SplitPath;
  readonly axis: SplitAxis;
  /** The area of the split the divider belongs to; drags are converted to ratios within it. */
  readonly region: Rect;
  /** Where the boundary sits, in unit coordinates along the split axis. */
  readonly position: number;
}

export interface PaneLayout {
  readonly panes: readonly PaneRect[];
  readonly dividers: readonly DividerRect[];
}

function divide(region: Rect, axis: SplitAxis, ratio: number): readonly [Rect, Rect] {
  if (axis === 'row') {
    const width = region.width * ratio;
    return [
      { ...region, width },
      { ...region, x: region.x + width, width: region.width - width },
    ];
  }
  const height = region.height * ratio;
  return [
    { ...region, height },
    { ...region, y: region.y + height, height: region.height - height },
  ];
}

/** Lays the tree out into non-overlapping rectangles that exactly tile `region`. */
export function computeLayout(tree: PaneNode, region: Rect = UNIT_RECT): PaneLayout {
  const panes: PaneRect[] = [];
  const dividers: DividerRect[] = [];
  const visit = (node: PaneNode, area: Rect, path: SplitBranch[]): void => {
    if (node.kind === 'leaf') {
      panes.push({ id: node.id, rect: area });
      return;
    }
    const [first, second] = divide(area, node.axis, node.ratio);
    dividers.push({
      path,
      axis: node.axis,
      region: area,
      position: node.axis === 'row' ? second.x : second.y,
    });
    visit(node.first, first, [...path, 'first']);
    visit(node.second, second, [...path, 'second']);
  };
  visit(tree, region, []);
  return { panes, dividers };
}

/** Converts a pointer position (unit coordinates) on a divider into the split's new ratio. */
export function ratioFromPointer(divider: DividerRect, pointer: { x: number; y: number }): number {
  const { region } = divider;
  return divider.axis === 'row'
    ? (pointer.x - region.x) / region.width
    : (pointer.y - region.y) / region.height;
}

const EPSILON = 1e-9;

type Span = readonly [start: number, end: number];

function overlap(a: Span, b: Span): number {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
}

interface Candidate {
  readonly id: PaneId;
  readonly distance: number;
  readonly shared: number;
}

function candidateFor(from: Rect, to: PaneRect, direction: Direction): Candidate | undefined {
  const { rect } = to;
  const horizontal = direction === 'left' || direction === 'right';
  const shared = horizontal
    ? overlap([from.y, from.y + from.height], [rect.y, rect.y + rect.height])
    : overlap([from.x, from.x + from.width], [rect.x, rect.x + rect.width]);
  if (shared <= EPSILON) return undefined;
  const distance = {
    left: from.x - (rect.x + rect.width),
    right: rect.x - (from.x + from.width),
    up: from.y - (rect.y + rect.height),
    down: rect.y - (from.y + from.height),
  }[direction];
  return distance >= -EPSILON ? { id: to.id, distance, shared } : undefined;
}

/** The pane next to `from` in `direction`: nearest first, then the one sharing the longest edge. */
export function navigate(
  layout: PaneLayout,
  from: PaneId,
  direction: Direction,
): PaneId | undefined {
  const origin = layout.panes.find((pane) => pane.id === from);
  if (origin === undefined) return undefined;
  let best: Candidate | undefined;
  for (const pane of layout.panes) {
    if (pane.id === from) continue;
    const candidate = candidateFor(origin.rect, pane, direction);
    if (candidate === undefined) continue;
    const closer = best === undefined || candidate.distance < best.distance - EPSILON;
    const tie = best !== undefined && Math.abs(candidate.distance - best.distance) <= EPSILON;
    if (closer || (tie && best !== undefined && candidate.shared > best.shared)) best = candidate;
  }
  return best?.id;
}
