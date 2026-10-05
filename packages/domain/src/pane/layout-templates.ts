import type { PaneId } from '../shared/ids';
import { paneLeaf, type PaneNode, type SplitAxis } from './pane-tree';

/** A way of arranging panes. Layouts reuse the existing panes, so their shells keep running. */
export interface LayoutTemplate {
  readonly id: string;
  readonly name: string;
  /** Fixed number of panes; missing ones are created. Undefined: fits any number of panes. */
  readonly slots?: number;
  /** Builds the tree for exactly `slots` (or at least one) panes, in reading order. */
  readonly build: (panes: readonly PaneId[]) => PaneNode;
}

/** Equal-sized panes along one axis. */
function chain(axis: SplitAxis, nodes: readonly PaneNode[]): PaneNode {
  const [head, ...rest] = nodes;
  if (head === undefined) throw new RangeError('a layout needs at least one pane');
  if (rest.length === 0) return head;
  return { kind: 'split', axis, ratio: 1 / nodes.length, first: head, second: chain(axis, rest) };
}

const leaves = (panes: readonly PaneId[]): PaneNode[] => panes.map(paneLeaf);

/** Rows of `columns` panes each; the last row takes what is left. */
function grid(panes: readonly PaneId[], columns: number): PaneNode {
  const rows: PaneNode[] = [];
  for (let i = 0; i < panes.length; i += columns) {
    rows.push(chain('row', leaves(panes.slice(i, i + columns))));
  }
  return chain('column', rows);
}

function mainAndStack(panes: readonly PaneId[], axis: SplitAxis): PaneNode {
  const [main, ...rest] = panes;
  if (main === undefined || rest.length === 0) return chain(axis, leaves(panes));
  const stack = chain(axis === 'row' ? 'column' : 'row', leaves(rest));
  return { kind: 'split', axis, ratio: 0.6, first: paneLeaf(main), second: stack };
}

const fixedGrid = (rows: number, columns: number): LayoutTemplate => ({
  id: `grid-${String(columns)}x${String(rows)}`,
  name: `${String(columns)}×${String(rows)} Grid`,
  slots: rows * columns,
  build: (panes) => grid(panes, columns),
});

export const LAYOUT_TEMPLATES: readonly LayoutTemplate[] = [
  { id: 'columns', name: 'Columns', build: (panes) => chain('row', leaves(panes)) },
  { id: 'rows', name: 'Rows', build: (panes) => chain('column', leaves(panes)) },
  {
    id: 'grid',
    name: 'Grid',
    build: (panes) => grid(panes, Math.ceil(Math.sqrt(panes.length))),
  },
  { id: 'main-left', name: 'Main Left', build: (panes) => mainAndStack(panes, 'row') },
  { id: 'main-top', name: 'Main Top', build: (panes) => mainAndStack(panes, 'column') },
  fixedGrid(2, 2),
  fixedGrid(2, 3),
  fixedGrid(3, 3),
];

export function findLayout(id: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((layout) => layout.id === id);
}

/** How many panes the layout needs given the current ones, or undefined when it cannot fit them. */
export function layoutSlots(layout: LayoutTemplate, current: number): number | undefined {
  if (layout.slots === undefined) return current;
  return layout.slots >= current ? layout.slots : undefined;
}
