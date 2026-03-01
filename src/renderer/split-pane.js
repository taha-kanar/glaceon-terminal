const { Terminal } = require('@xterm/xterm');
const { FitAddon } = require('@xterm/addon-fit');
const { WebLinksAddon } = require('@xterm/addon-web-links');
const { createSearchAddon, removeSearchAddon } = require('@renderer/search');
const linkHandler = require('@renderer/link-handler');

let paneCounter = 0;
let termIdCounter = 0;
let getTerminalThemeFn = null;
let attachKeyHandlerFn = null;
let getSettingsFn = null;

function init(opts) {
  getTerminalThemeFn = opts.getTerminalTheme;
  attachKeyHandlerFn = opts.attachKeyHandler;
  if (opts.getSettings) getSettingsFn = opts.getSettings;
}

function generatePaneId() {
  return `pane-${++paneCounter}`;
}

function generateTerminalId() {
  return `term-${++termIdCounter}`;
}

function setTermIdCounter(val) {
  termIdCounter = val;
}

// Create a leaf pane with a new terminal
function createPaneLeaf(profileId, fontOverrides, overrideIds) {
  const paneId = (overrideIds && overrideIds.paneId) || generatePaneId();
  const terminalId = (overrideIds && overrideIds.terminalId) || generateTerminalId();

  const theme = getTerminalThemeFn ? getTerminalThemeFn() : {};
  const userSettings = getSettingsFn ? getSettingsFn() : {};

  const termOptions = {
    theme,
    fontFamily: userSettings.fontFamily || "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    fontSize: userSettings.fontSize || 14,
    lineHeight: 1.2,
    cursorBlink: userSettings.cursorBlink != null ? userSettings.cursorBlink : true,
    cursorStyle: userSettings.cursorStyle || 'bar',
    scrollback: userSettings.scrollback || 10000,
    allowProposedApi: true,
  };

  // Apply font overrides from profile
  if (fontOverrides) {
    if (fontOverrides.family) termOptions.fontFamily = fontOverrides.family;
    if (fontOverrides.size) termOptions.fontSize = fontOverrides.size;
    if (fontOverrides.lineHeight) termOptions.lineHeight = fontOverrides.lineHeight;
  }

  const term = new Terminal(termOptions);
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());

  const searchAddon = createSearchAddon(term, terminalId);

  // Key handler
  if (attachKeyHandlerFn) attachKeyHandlerFn(term);

  // Create DOM
  const wrapper = document.createElement('div');
  wrapper.className = 'pane';
  wrapper.dataset.paneId = paneId;

  const termContainer = document.createElement('div');
  termContainer.className = 'pane-terminal';
  wrapper.appendChild(termContainer);

  term.open(termContainer);

  // Register link provider for clickable paths
  linkHandler.registerLinkProvider(term, terminalId);

  // Connect terminal input to PTY
  term.onData((data) => {
    window.terminalAPI.write(terminalId, data);
  });

  term.onResize(({ cols, rows }) => {
    window.terminalAPI.resize(terminalId, cols, rows);
  });

  // Focus handling
  term.textarea.addEventListener('focus', () => {
    // Will be handled by renderer via event
    wrapper.dispatchEvent(new CustomEvent('pane-focus', { bubbles: true, detail: { paneId } }));
  });

  // Drag-and-drop files into terminal
  wrapper.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      wrapper.classList.add('file-drop-hover');
    }
  });

  wrapper.addEventListener('dragleave', (e) => {
    if (!wrapper.contains(e.relatedTarget)) {
      wrapper.classList.remove('file-drop-hover');
    }
  });

  wrapper.addEventListener('drop', (e) => {
    wrapper.classList.remove('file-drop-hover');
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    const paths = Array.from(e.dataTransfer.files).map((f) => {
      // Escape spaces and special chars for shell
      return f.path.replace(/([ '"\\$`!&(){}[\]|;<>?*#~])/g, '\\$1');
    });
    window.terminalAPI.write(terminalId, paths.join(' '));
    term.focus();
  });

  return {
    type: 'leaf',
    id: paneId,
    terminalId,
    term,
    fitAddon,
    searchAddon,
    wrapper,
    profileId: profileId || null,
  };
}

// Split an existing leaf into a branch
function splitPane(leaf, direction, profileId, fontOverrides) {
  const newLeaf = createPaneLeaf(profileId, fontOverrides);

  const branch = {
    type: 'branch',
    id: generatePaneId(),
    direction, // 'horizontal' or 'vertical'
    ratio: 0.5,
    children: [
      // First child inherits existing terminal
      leaf,
      // Second child is new
      newLeaf,
    ],
    container: null,
  };

  // Build DOM
  const container = document.createElement('div');
  container.className = `split-container ${direction}`;
  container.dataset.paneId = branch.id;

  const divider = document.createElement('div');
  divider.className = 'split-divider';

  // Replace leaf's wrapper in DOM with the container
  const parent = leaf.wrapper.parentElement;
  if (parent) {
    // Inherit the flex from the leaf being replaced so the new branch
    // occupies the same space in the parent flex layout
    const inheritedFlex = leaf.wrapper.style.flex || '';
    parent.replaceChild(container, leaf.wrapper);
    if (inheritedFlex) container.style.flex = inheritedFlex;
  }

  // Reset leaf's flex — it's now a child of the new branch, ratio handles sizing
  leaf.wrapper.style.flex = '';

  container.appendChild(leaf.wrapper);
  container.appendChild(divider);
  container.appendChild(newLeaf.wrapper);

  // Apply ratio
  applyRatio(branch);

  branch.container = container;

  // Draggable divider
  setupDividerDrag(divider, branch);

  return { branch, newLeaf };
}

function applyRatio(branch) {
  if (branch.type !== 'branch' || branch.children.length !== 2) return;

  const el0 = getDomElement(branch.children[0]);
  const el1 = getDomElement(branch.children[1]);

  if (el0) el0.style.flex = `${branch.ratio} 1 0%`;
  if (el1) el1.style.flex = `${1 - branch.ratio} 1 0%`;
}

function getDomElement(node) {
  if (node.type === 'leaf') return node.wrapper;
  if (node.type === 'branch') return node.container;
  return null;
}

function setupDividerDrag(divider, branch) {
  let startPos = 0;
  let startRatio = 0;
  let containerSize = 0;
  let rafId = null;

  function onMouseDown(e) {
    e.preventDefault();
    divider.classList.add('dragging');
    startRatio = branch.ratio;
    const rect = branch.container.getBoundingClientRect();

    if (branch.direction === 'horizontal') {
      startPos = e.clientX;
      containerSize = rect.width;
    } else {
      startPos = e.clientY;
      containerSize = rect.height;
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = branch.direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  function onMouseMove(e) {
    const current = branch.direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = (current - startPos) / containerSize;
    branch.ratio = Math.max(0.1, Math.min(0.9, startRatio + delta));
    applyRatio(branch);
    // Debounce refit via rAF to avoid layout thrashing
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      refitPaneTree(branch);
      rafId = null;
    });
  }

  function onMouseUp() {
    divider.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    refitPaneTree(branch);
  }

  divider.addEventListener('mousedown', onMouseDown);
}

// Recursively fit all terminals in a pane tree
function refitPaneTree(node) {
  if (!node) return;
  if (node.type === 'leaf') {
    try {
      // Check visibility — zero-size elements can't be fit
      const rect = node.wrapper.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        node.fitAddon.fit();
      }
    } catch (e) {
      // terminal may not be visible yet
    }
    return;
  }
  if (node.type === 'branch') {
    node.children.forEach(refitPaneTree);
  }
}

// Find a leaf by pane ID in the tree
function findLeaf(node, paneId) {
  if (!node) return null;
  if (node.type === 'leaf' && node.id === paneId) return node;
  if (node.type === 'branch') {
    for (const child of node.children) {
      const found = findLeaf(child, paneId);
      if (found) return found;
    }
  }
  return null;
}

// Find a leaf by terminal ID
function findLeafByTerminalId(node, terminalId) {
  if (!node) return null;
  if (node.type === 'leaf' && node.terminalId === terminalId) return node;
  if (node.type === 'branch') {
    for (const child of node.children) {
      const found = findLeafByTerminalId(child, terminalId);
      if (found) return found;
    }
  }
  return null;
}

// Find parent branch of a node
function findParent(root, targetId) {
  if (!root || root.type !== 'branch') return null;
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === targetId) return { parent: root, index: i };
    const found = findParent(root.children[i], targetId);
    if (found) return found;
  }
  return null;
}

// Close a pane — returns the remaining sibling or null if last pane
function closePane(root, paneId) {
  const parentInfo = findParent(root, paneId);
  if (!parentInfo) {
    // This is the root itself (single pane)
    return null;
  }

  const { parent, index } = parentInfo;
  const siblingIndex = index === 0 ? 1 : 0;
  const sibling = parent.children[siblingIndex];

  // Replace parent's container with sibling's element in the DOM
  const parentEl = parent.container;
  const siblingEl = getDomElement(sibling);
  const grandParent = parentEl.parentElement;

  if (grandParent) {
    // Inherit parent's flex so sibling fills the same space in the grandparent
    const inheritedFlex = parentEl.style.flex || '';
    grandParent.replaceChild(siblingEl, parentEl);
    siblingEl.style.flex = inheritedFlex;
  }

  // Return sibling to be inserted into tree at parent's position
  return { sibling, parentId: parent.id };
}

// Replace a node in the tree by its ID
function replaceNode(root, targetId, newNode) {
  if (root.id === targetId) return newNode;
  if (root.type === 'branch') {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === targetId) {
        root.children[i] = newNode;
        return root;
      }
      const result = replaceNode(root.children[i], targetId, newNode);
      if (result !== root.children[i]) {
        root.children[i] = result;
      }
    }
  }
  return root;
}

// Collect all leaves in a tree
function collectLeaves(node) {
  if (!node || node.id === '__empty__') return [];
  if (node.type === 'leaf') return [node];
  if (node.type === 'branch') {
    return node.children.flatMap(collectLeaves);
  }
  return [];
}

// Navigate panes: find the nearest pane in a given direction
function navigatePane(root, currentPaneId, direction) {
  const leaves = collectLeaves(root);
  if (leaves.length <= 1) return null;

  const current = leaves.find((l) => l.id === currentPaneId);
  if (!current) return leaves[0];

  const currentRect = current.wrapper.getBoundingClientRect();
  const cx = currentRect.left + currentRect.width / 2;
  const cy = currentRect.top + currentRect.height / 2;

  let best = null;
  let bestDist = Infinity;

  for (const leaf of leaves) {
    if (leaf.id === currentPaneId) continue;
    const rect = leaf.wrapper.getBoundingClientRect();
    const lx = rect.left + rect.width / 2;
    const ly = rect.top + rect.height / 2;

    let valid = false;
    switch (direction) {
      case 'left':  valid = lx < cx - 10; break;
      case 'right': valid = lx > cx + 10; break;
      case 'up':    valid = ly < cy - 10; break;
      case 'down':  valid = ly > cy + 10; break;
    }

    if (valid) {
      const dist = Math.abs(lx - cx) + Math.abs(ly - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = leaf;
      }
    }
  }

  return best;
}

// Focus a pane visually
function focusPane(root, paneId) {
  const leaves = collectLeaves(root);
  leaves.forEach((l) => l.wrapper.classList.remove('focused'));
  const target = leaves.find((l) => l.id === paneId);
  if (target) {
    target.wrapper.classList.add('focused');
    target.term.focus();
  }
}

// Dispose all terminals in a tree
function disposePaneTree(node) {
  if (!node) return;
  if (node.type === 'leaf') {
    removeSearchAddon(node.terminalId);
    node.term.dispose();
    window.terminalAPI.kill(node.terminalId);
    return;
  }
  if (node.type === 'branch') {
    node.children.forEach(disposePaneTree);
  }
}

// Get the first leaf in the tree (for default focus)
function getFirstLeaf(node) {
  if (!node) return null;
  if (node.type === 'leaf') return node;
  if (node.type === 'branch') return getFirstLeaf(node.children[0]);
  return null;
}

// ── Counter getters/setters ──
function getPaneCounter() { return paneCounter; }
function setPaneCounter(val) { paneCounter = val; }
function getTermIdCounter() { return termIdCounter; }

// ── Serialize pane tree to JSON ──
function serializePaneTree(node, cwdMap) {
  if (!node || node.id === '__empty__') return null;
  if (node.type === 'leaf') {
    // Extract last 1000 lines from terminal buffer
    let buffer = '';
    try {
      const buf = node.term.buffer.active;
      const totalLines = buf.length;
      const start = Math.max(0, totalLines - 1000);
      const lines = [];
      for (let i = start; i < totalLines; i++) {
        const line = buf.getLine(i);
        if (line) lines.push(line.translateToString(true));
      }
      buffer = lines.join('\n');
      // Trim trailing empty lines
      buffer = buffer.replace(/\n+$/, '');
    } catch (e) {
      // terminal may be disposed
    }

    return {
      type: 'leaf',
      id: node.id,
      terminalId: node.terminalId,
      profileId: node.profileId || null,
      cwd: (cwdMap && cwdMap[node.terminalId]) || null,
      buffer,
    };
  }
  if (node.type === 'branch') {
    return {
      type: 'branch',
      id: node.id,
      direction: node.direction,
      ratio: node.ratio,
      children: node.children.map((c) => serializePaneTree(c, cwdMap)),
    };
  }
  return null;
}

// ── Deserialize pane tree from JSON ──
// Returns { node, leaves } where leaves is an array of { leaf, cwd, profileId, buffer }
function deserializePaneTree(serialized, fontOverrides) {
  if (!serialized) return null;
  const leaves = [];

  function rebuild(data) {
    if (data.type === 'leaf') {
      const leaf = createPaneLeaf(data.profileId, fontOverrides, {
        paneId: data.id,
        terminalId: data.terminalId,
      });
      leaves.push({
        leaf,
        cwd: data.cwd,
        profileId: data.profileId,
        buffer: data.buffer || '',
      });
      return leaf;
    }
    if (data.type === 'branch') {
      const child0 = rebuild(data.children[0]);
      const child1 = rebuild(data.children[1]);

      const branch = {
        type: 'branch',
        id: data.id,
        direction: data.direction,
        ratio: data.ratio,
        children: [child0, child1],
        container: null,
      };

      const container = document.createElement('div');
      container.className = `split-container ${data.direction}`;
      container.dataset.paneId = data.id;

      const divider = document.createElement('div');
      divider.className = 'split-divider';

      container.appendChild(getDomElement(child0));
      container.appendChild(divider);
      container.appendChild(getDomElement(child1));

      branch.container = container;
      applyRatio(branch);
      setupDividerDrag(divider, branch);

      return branch;
    }
    return null;
  }

  const node = rebuild(serialized);
  return { node, leaves };
}

module.exports = {
  init,
  generatePaneId,
  generateTerminalId,
  setTermIdCounter,
  getPaneCounter,
  setPaneCounter,
  getTermIdCounter,
  createPaneLeaf,
  splitPane,
  applyRatio,
  setupDividerDrag,
  refitPaneTree,
  findLeaf,
  findLeafByTerminalId,
  findParent,
  closePane,
  replaceNode,
  collectLeaves,
  navigatePane,
  focusPane,
  disposePaneTree,
  getFirstLeaf,
  getDomElement,
  serializePaneTree,
  deserializePaneTree,
};
