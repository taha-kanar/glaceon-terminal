// ── Drag-Drop Pane Between Tabs ──
// Drag a pane via grip handle → drop onto another pane (to split) or tab bar (new tab)

const splitPaneMod = require('@renderer/split-pane');

let callbacks = {};
let draggedPane = null; // { terminalId, tabId, paneId, leaf }
let dropIndicator = null;

function init(opts) {
  callbacks = opts;
  createDropIndicator();
  setupTabBarDrop();
}

function createDropIndicator() {
  if (dropIndicator) return; // guard against double-init
  dropIndicator = document.createElement('div');
  dropIndicator.className = 'pane-drop-indicator';
  document.body.appendChild(dropIndicator);
}

function attachDragHandle(leaf) {
  if (!leaf || leaf.type !== 'leaf') return;
  // Don't double-add
  if (leaf.wrapper.querySelector('.pane-drag-handle')) return;

  const handle = document.createElement('div');
  handle.className = 'pane-drag-handle';
  handle.draggable = true;
  handle.title = 'Drag to move pane';
  handle.innerHTML = `
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <circle cx="3" cy="2" r="1"/>
      <circle cx="7" cy="2" r="1"/>
      <circle cx="3" cy="5" r="1"/>
      <circle cx="7" cy="5" r="1"/>
      <circle cx="3" cy="8" r="1"/>
      <circle cx="7" cy="8" r="1"/>
    </svg>
  `;

  handle.addEventListener('dragstart', (e) => {
    // Unzoom if zoomed
    const zoomState = callbacks.getZoomState?.();
    const activeTabId = callbacks.getActiveTabId?.();
    if (zoomState && activeTabId && zoomState.has(activeTabId)) {
      callbacks.toggleZoom?.();
    }

    const mapping = callbacks.getPaneMap?.().get(leaf.terminalId);
    if (!mapping) { e.preventDefault(); return; }

    draggedPane = {
      terminalId: leaf.terminalId,
      tabId: mapping.tabId,
      paneId: leaf.id,
      leaf,
    };

    e.dataTransfer.setData('application/pane-drag', leaf.terminalId);
    e.dataTransfer.effectAllowed = 'move';
    leaf.wrapper.classList.add('pane-dragging');
  });

  handle.addEventListener('dragend', () => {
    if (leaf.wrapper) leaf.wrapper.classList.remove('pane-dragging');
    hideDropIndicator();
    draggedPane = null;
    // Remove tabbar drop styling
    const tabbar = document.getElementById('tabbar');
    if (tabbar) tabbar.classList.remove('pane-drop-target');
  });

  // Set up drop target on this pane's wrapper
  setupPaneDropTarget(leaf);

  leaf.wrapper.appendChild(handle);
}

function setupPaneDropTarget(leaf) {
  const wrapper = leaf.wrapper;

  wrapper.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/pane-drag')) return;
    if (!draggedPane || draggedPane.terminalId === leaf.terminalId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Determine quadrant
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const quadrant = getQuadrant(x, y, rect.width, rect.height);

    showDropIndicator(rect, quadrant);
  });

  wrapper.addEventListener('dragleave', (e) => {
    if (!wrapper.contains(e.relatedTarget)) {
      hideDropIndicator();
    }
  });

  wrapper.addEventListener('drop', (e) => {
    if (!e.dataTransfer.types.includes('application/pane-drag')) return;
    if (!draggedPane || draggedPane.terminalId === leaf.terminalId) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const quadrant = getQuadrant(x, y, rect.width, rect.height);

    hideDropIndicator();
    performPaneDrop(draggedPane, leaf, quadrant);
    draggedPane = null;
  });
}

function setupTabBarDrop() {
  const tabbar = document.getElementById('tabbar');
  if (!tabbar) return;

  tabbar.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/pane-drag')) return;
    if (!draggedPane) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    tabbar.classList.add('pane-drop-target');
  });

  tabbar.addEventListener('dragleave', (e) => {
    if (!tabbar.contains(e.relatedTarget)) {
      tabbar.classList.remove('pane-drop-target');
    }
  });

  tabbar.addEventListener('drop', (e) => {
    if (!e.dataTransfer.types.includes('application/pane-drag')) return;
    if (!draggedPane) return;
    e.preventDefault();
    tabbar.classList.remove('pane-drop-target');

    const { leaf, tabId } = draggedPane;
    draggedPane = null;

    // Remove pane from source tab
    removePaneFromSource(leaf, tabId);

    // Create new tab with this leaf
    callbacks.createTabWithPane?.(leaf);
  });
}

function getQuadrant(x, y, w, h) {
  const relX = x / w;
  const relY = y / h;

  // Check which edge is closest
  const distLeft = relX;
  const distRight = 1 - relX;
  const distTop = relY;
  const distBottom = 1 - relY;

  const min = Math.min(distLeft, distRight, distTop, distBottom);
  if (min === distLeft) return 'left';
  if (min === distRight) return 'right';
  if (min === distTop) return 'top';
  return 'bottom';
}

function showDropIndicator(rect, quadrant) {
  if (!dropIndicator) return;
  dropIndicator.style.display = 'block';

  const half = 0.5;
  let top = rect.top, left = rect.left, width = rect.width, height = rect.height;

  switch (quadrant) {
    case 'left':
      width = rect.width * half;
      break;
    case 'right':
      left = rect.left + rect.width * half;
      width = rect.width * half;
      break;
    case 'top':
      height = rect.height * half;
      break;
    case 'bottom':
      top = rect.top + rect.height * half;
      height = rect.height * half;
      break;
  }

  dropIndicator.style.top = `${top}px`;
  dropIndicator.style.left = `${left}px`;
  dropIndicator.style.width = `${width}px`;
  dropIndicator.style.height = `${height}px`;
}

function hideDropIndicator() {
  if (dropIndicator) dropIndicator.style.display = 'none';
}

function removePaneFromSource(leaf, sourceTabId) {
  const tabs = callbacks.getTabs?.();
  if (!tabs) return;
  const tabEntry = tabs.get(sourceTabId);
  if (!tabEntry) return;

  const leaves = splitPaneMod.collectLeaves(tabEntry.rootPane);
  if (leaves.length <= 1) {
    // This was the only pane — tab will be empty
    // Remove from pane map
    callbacks.getPaneMap?.().delete(leaf.terminalId);
    // Don't dispose the terminal — we're moving it
    leaf.wrapper.remove();
    // Set rootPane to null so closeTabIfEmpty sees it as empty
    tabEntry.rootPane = { type: 'branch', id: '__empty__', children: [], container: null };
    // Close empty tab
    callbacks.closeTabIfEmpty?.(sourceTabId);
    return;
  }

  // Remove from pane map
  callbacks.getPaneMap?.().delete(leaf.terminalId);

  // Detach from DOM
  leaf.wrapper.remove();

  // Close pane in tree (promotes sibling)
  const result = splitPaneMod.closePane(tabEntry.rootPane, leaf.id);
  if (result) {
    if (result.parentId === tabEntry.rootPane.id) {
      tabEntry.rootPane = result.sibling;
    } else {
      tabEntry.rootPane = splitPaneMod.replaceNode(tabEntry.rootPane, result.parentId, result.sibling);
    }
  }

  // Focus first remaining pane
  const firstLeaf = splitPaneMod.getFirstLeaf(tabEntry.rootPane);
  if (firstLeaf) {
    tabEntry.activePaneId = firstLeaf.id;
    splitPaneMod.focusPane(tabEntry.rootPane, firstLeaf.id);
  }

  callbacks.refitTab?.(sourceTabId);
}

function performPaneDrop(source, targetLeaf, quadrant) {
  const { leaf: sourceLeaf, tabId: sourceTabId } = source;
  const paneMap = callbacks.getPaneMap?.();
  const tabs = callbacks.getTabs?.();
  if (!paneMap || !tabs) return;

  const targetMapping = paneMap.get(targetLeaf.terminalId);
  if (!targetMapping) return;
  const targetTabId = targetMapping.tabId;
  const targetTabEntry = tabs.get(targetTabId);
  if (!targetTabEntry) return;

  // 1. Remove source leaf from source tree
  removePaneFromSource(sourceLeaf, sourceTabId);

  // 2. Determine split direction and order
  const direction = (quadrant === 'left' || quadrant === 'right') ? 'horizontal' : 'vertical';
  const sourceFirst = (quadrant === 'left' || quadrant === 'top');

  // 3. Create branch containing target + source
  const branchId = splitPaneMod.generatePaneId();
  const branch = {
    type: 'branch',
    id: branchId,
    direction,
    ratio: 0.5,
    children: sourceFirst ? [sourceLeaf, targetLeaf] : [targetLeaf, sourceLeaf],
    container: null,
  };

  // Build DOM
  const container = document.createElement('div');
  container.className = `split-container ${direction}`;
  container.dataset.paneId = branchId;

  const divider = document.createElement('div');
  divider.className = 'split-divider';

  // Replace target leaf's wrapper in DOM with the new branch container
  const parent = targetLeaf.wrapper.parentElement;
  if (parent) {
    const inheritedFlex = targetLeaf.wrapper.style.flex || '';
    parent.replaceChild(container, targetLeaf.wrapper);
    if (inheritedFlex) container.style.flex = inheritedFlex;
  }

  targetLeaf.wrapper.style.flex = '';
  sourceLeaf.wrapper.style.flex = '';

  if (sourceFirst) {
    container.appendChild(sourceLeaf.wrapper);
    container.appendChild(divider);
    container.appendChild(targetLeaf.wrapper);
  } else {
    container.appendChild(targetLeaf.wrapper);
    container.appendChild(divider);
    container.appendChild(sourceLeaf.wrapper);
  }

  branch.container = container;
  splitPaneMod.applyRatio(branch);
  splitPaneMod.setupDividerDrag(divider, branch);

  // 4. Update tree: replace target leaf in tree with the new branch
  if (targetTabEntry.rootPane.id === targetLeaf.id) {
    targetTabEntry.rootPane = branch;
    // Branch container is already in wrapper
  } else {
    targetTabEntry.rootPane = splitPaneMod.replaceNode(targetTabEntry.rootPane, targetLeaf.id, branch);
  }

  // 5. Update pane map for moved pane
  paneMap.set(sourceLeaf.terminalId, { tabId: targetTabId, paneId: sourceLeaf.id });

  // 6. Refit
  callbacks.refitTab?.(targetTabId);
  callbacks.scheduleSessionSave?.();
}

module.exports = {
  init,
  attachDragHandle,
};
