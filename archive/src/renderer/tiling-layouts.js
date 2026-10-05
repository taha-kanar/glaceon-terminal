// ── Tiling Layouts (F7) ──
// Predefined pane arrangements

const LAYOUTS = [
  {
    id: 'even-horizontal',
    name: '2 Side-by-Side',
    leafCount: 2,
    build: () => ({
      type: 'branch',
      direction: 'horizontal',
      ratio: 0.5,
      children: [{ type: 'leaf' }, { type: 'leaf' }],
    }),
  },
  {
    id: 'even-vertical',
    name: '2 Stacked',
    leafCount: 2,
    build: () => ({
      type: 'branch',
      direction: 'vertical',
      ratio: 0.5,
      children: [{ type: 'leaf' }, { type: 'leaf' }],
    }),
  },
  {
    id: '2x2',
    name: '2x2 Grid',
    leafCount: 4,
    build: () => ({
      type: 'branch',
      direction: 'vertical',
      ratio: 0.5,
      children: [
        {
          type: 'branch',
          direction: 'horizontal',
          ratio: 0.5,
          children: [{ type: 'leaf' }, { type: 'leaf' }],
        },
        {
          type: 'branch',
          direction: 'horizontal',
          ratio: 0.5,
          children: [{ type: 'leaf' }, { type: 'leaf' }],
        },
      ],
    }),
  },
  {
    id: '1-plus-2',
    name: 'Main + 2 Side',
    leafCount: 3,
    build: () => ({
      type: 'branch',
      direction: 'horizontal',
      ratio: 0.6,
      children: [
        { type: 'leaf' },
        {
          type: 'branch',
          direction: 'vertical',
          ratio: 0.5,
          children: [{ type: 'leaf' }, { type: 'leaf' }],
        },
      ],
    }),
  },
  {
    id: '3-column',
    name: '3 Columns',
    leafCount: 3,
    build: () => ({
      type: 'branch',
      direction: 'horizontal',
      ratio: 0.33,
      children: [
        { type: 'leaf' },
        {
          type: 'branch',
          direction: 'horizontal',
          ratio: 0.5,
          children: [{ type: 'leaf' }, { type: 'leaf' }],
        },
      ],
    }),
  },
  {
    id: '2x3-grid',
    name: '2x3 Grid (6)',
    leafCount: 6,
    build: () => buildGrid(2, 3),
  },
  {
    id: '3x3-grid',
    name: '3x3 Grid (9)',
    leafCount: 9,
    build: () => buildGrid(3, 3),
  },
  {
    id: '2x4-grid',
    name: '2x4 Grid (8)',
    leafCount: 8,
    build: () => buildGrid(2, 4),
  },
  {
    id: '4x4-grid',
    name: '4x4 Grid (16)',
    leafCount: 16,
    build: () => buildGrid(4, 4),
  },
];

// Build an rows x cols grid layout
function buildGrid(rows, cols) {
  function makeRow(count) {
    if (count === 1) return { type: 'leaf' };
    const ratio = 1 / count;
    return {
      type: 'branch',
      direction: 'horizontal',
      ratio,
      children: [{ type: 'leaf' }, makeRow(count - 1)],
    };
  }
  function stackRows(rowNodes) {
    if (rowNodes.length === 1) return rowNodes[0];
    const ratio = 1 / rowNodes.length;
    return {
      type: 'branch',
      direction: 'vertical',
      ratio,
      children: [rowNodes[0], stackRows(rowNodes.slice(1))],
    };
  }
  const rowNodes = [];
  for (let r = 0; r < rows; r++) {
    rowNodes.push(makeRow(cols));
  }
  return stackRows(rowNodes);
}

function getLayouts() {
  return LAYOUTS;
}

function getLayout(id) {
  return LAYOUTS.find((l) => l.id === id) || null;
}

// Count leaf nodes in a layout definition
function countLeaves(node) {
  if (node.type === 'leaf') return 1;
  if (node.type === 'branch') {
    return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
  }
  return 0;
}

module.exports = {
  getLayouts,
  getLayout,
  countLeaves,
};
