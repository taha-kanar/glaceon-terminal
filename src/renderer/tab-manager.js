const { showContextMenu, TAB_COLORS } = require('@renderer/context-menu');

// Tab metadata: Map<tabId, { label, colorLabel, locked, pinned, processName }>
const tabMeta = new Map();

// ── Tab Group State ──
const tabGroups = new Map();      // groupId → { id, label, color, collapsed, tabIds }
const tabToGroup = new Map();     // tabId → groupId
const selectedTabs = new Set();   // Ctrl+Click multi-select
let groupCounter = 0;

const GROUP_COLORS = [
  '#f7768e', '#ff9e64', '#e0af68', '#9ece6a',
  '#7dcfff', '#7aa2f7', '#bb9af7',
];

// Callbacks set by renderer
let callbacks = {
  onReorder: null,    // (orderedTabIds) => void
  onClose: null,      // (tabId) => void
  onSwitch: null,     // (tabId) => void
  onMoveLeft: null,   // (tabId) => void
  onMoveRight: null,  // (tabId) => void
  onRename: null,     // (tabId, newName) => void
  onGroupChanged: null, // () => void
};

function initTabManager(cbs) {
  callbacks = { ...callbacks, ...cbs };
}

function registerTab(tabId, tabEl) {
  if (!tabMeta.has(tabId)) {
    tabMeta.set(tabId, { label: null, colorLabel: '', locked: false, pinned: false, processName: '' });
  }
  setupDragDrop(tabEl, tabId);
  setupContextMenu(tabEl, tabId);
}

function unregisterTab(tabId) {
  tabMeta.delete(tabId);
  removeTabFromGroup(tabId);
  selectedTabs.delete(tabId);
}

function getMeta(tabId) {
  return tabMeta.get(tabId);
}

function isLocked(tabId) {
  const meta = tabMeta.get(tabId);
  return meta ? meta.locked : false;
}

function isPinned(tabId) {
  const meta = tabMeta.get(tabId);
  return meta ? meta.pinned : false;
}

// ── Tab Group CRUD ──
function createGroup(label, color) {
  const id = `group-${++groupCounter}`;
  tabGroups.set(id, { id, label, color: color || GROUP_COLORS[groupCounter % GROUP_COLORS.length], collapsed: false, tabIds: [] });
  return id;
}

function deleteGroup(groupId) {
  const group = tabGroups.get(groupId);
  if (!group) return;
  // Remove all tabs from this group
  for (const tabId of [...group.tabIds]) {
    tabToGroup.delete(tabId);
  }
  tabGroups.delete(groupId);
}

function addTabToGroup(tabId, groupId) {
  const group = tabGroups.get(groupId);
  if (!group) return;
  // Remove from old group first
  removeTabFromGroup(tabId);
  group.tabIds.push(tabId);
  tabToGroup.set(tabId, groupId);
}

function removeTabFromGroup(tabId) {
  const oldGroupId = tabToGroup.get(tabId);
  if (oldGroupId) {
    const oldGroup = tabGroups.get(oldGroupId);
    if (oldGroup) {
      oldGroup.tabIds = oldGroup.tabIds.filter((id) => id !== tabId);
      // Auto-delete empty groups
      if (oldGroup.tabIds.length === 0) {
        tabGroups.delete(oldGroupId);
      }
    }
    tabToGroup.delete(tabId);
  }
}

function getGroupId(tabId) {
  return tabToGroup.get(tabId) || null;
}

function getGroups() {
  return [...tabGroups.values()].map((g) => ({
    id: g.id,
    label: g.label,
    color: g.color,
    collapsed: g.collapsed,
    tabIds: [...g.tabIds],
  }));
}

function getGroup(groupId) {
  return tabGroups.get(groupId) || null;
}

function renameGroup(groupId, label) {
  const group = tabGroups.get(groupId);
  if (group) group.label = label;
}

function setGroupColor(groupId, color) {
  const group = tabGroups.get(groupId);
  if (group) group.color = color;
}

function toggleGroupCollapse(groupId) {
  const group = tabGroups.get(groupId);
  if (group) group.collapsed = !group.collapsed;
}

function restoreGroups(serializedGroups) {
  tabGroups.clear();
  tabToGroup.clear();
  groupCounter = 0;
  for (const g of serializedGroups) {
    tabGroups.set(g.id, {
      id: g.id,
      label: g.label,
      color: g.color,
      collapsed: g.collapsed || false,
      tabIds: [...(g.tabIds || [])],
    });
    for (const tabId of g.tabIds) {
      tabToGroup.set(tabId, g.id);
    }
    // Keep groupCounter above all existing IDs
    const match = g.id.match(/group-(\d+)/);
    if (match) groupCounter = Math.max(groupCounter, parseInt(match[1]));
  }
}

// ── Multi-select ──
function toggleTabSelection(tabId) {
  const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
  if (selectedTabs.has(tabId)) {
    selectedTabs.delete(tabId);
    if (tabEl) tabEl.classList.remove('selected');
  } else {
    selectedTabs.add(tabId);
    if (tabEl) tabEl.classList.add('selected');
  }
}

function getSelectedTabs() {
  return new Set(selectedTabs);
}

function clearSelection() {
  selectedTabs.forEach((tabId) => {
    const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
    if (tabEl) tabEl.classList.remove('selected');
  });
  selectedTabs.clear();
}

// ── Render Groups ──
function renderGroups(tabsContainer) {
  if (!tabsContainer) return;

  // Remove existing group headers
  tabsContainer.querySelectorAll('.tab-group-header').forEach((el) => el.remove());

  // Reset grouped styling on all tabs
  tabsContainer.querySelectorAll('.tab').forEach((tabEl) => {
    tabEl.classList.remove('grouped');
    tabEl.style.removeProperty('--group-color');
    tabEl.style.display = '';
  });

  // For each group, insert header and style tabs
  for (const [groupId, group] of tabGroups) {
    if (group.tabIds.length === 0) continue;

    // Find the first tab element in this group (by DOM order)
    let firstTabEl = null;
    const tabEls = [...tabsContainer.querySelectorAll('.tab')];
    for (const tabEl of tabEls) {
      if (group.tabIds.includes(tabEl.dataset.id)) {
        if (!firstTabEl) firstTabEl = tabEl;
        // Style grouped tabs
        tabEl.classList.add('grouped');
        tabEl.style.setProperty('--group-color', group.color);
        if (group.collapsed) {
          tabEl.style.display = 'none';
        }
      }
    }

    if (!firstTabEl) continue;

    // Create header
    const header = document.createElement('div');
    header.className = 'tab-group-header';
    header.dataset.groupId = groupId;
    header.dataset.collapsed = group.collapsed ? 'true' : 'false';
    header.innerHTML = `<span class="tab-group-label" style="--group-color: ${group.color}">${group.label}</span>`;

    // Click toggles collapse
    header.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      toggleGroupCollapse(groupId);
      renderGroups(tabsContainer);
      if (callbacks.onGroupChanged) callbacks.onGroupChanged();
    });

    // Right-click context menu on header
    header.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      const items = [
        { action: 'rename-group', label: 'Rename Group', groupId },
        { separator: true },
        ...GROUP_COLORS.map((c) => ({
          action: 'group-color',
          label: `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};vertical-align:middle"></span>`,
          groupId,
          color: c,
        })),
        { separator: true },
        { action: 'ungroup-all', label: 'Ungroup All Tabs', groupId },
        { action: 'close-group', label: 'Close All Tabs in Group', groupId },
      ];

      const result = await showContextMenu(e.clientX, e.clientY, items);
      if (!result) return;

      switch (result.action) {
        case 'rename-group':
          startGroupRename(header, result.groupId || groupId);
          break;
        case 'group-color':
          setGroupColor(result.groupId || groupId, result.color);
          renderGroups(tabsContainer);
          if (callbacks.onGroupChanged) callbacks.onGroupChanged();
          break;
        case 'ungroup-all': {
          const g = tabGroups.get(result.groupId || groupId);
          if (g) {
            for (const tid of [...g.tabIds]) {
              tabToGroup.delete(tid);
            }
            tabGroups.delete(result.groupId || groupId);
          }
          renderGroups(tabsContainer);
          if (callbacks.onGroupChanged) callbacks.onGroupChanged();
          break;
        }
        case 'close-group': {
          const g = tabGroups.get(result.groupId || groupId);
          if (g && callbacks.onClose) {
            for (const tid of [...g.tabIds]) {
              const meta = tabMeta.get(tid);
              if (meta && !meta.locked && !meta.pinned) {
                callbacks.onClose(tid);
              }
            }
          }
          break;
        }
      }
    });

    tabsContainer.insertBefore(header, firstTabEl);
  }
}

function startGroupRename(headerEl, groupId) {
  const labelEl = headerEl.querySelector('.tab-group-label');
  if (!labelEl) return;

  labelEl.contentEditable = 'true';
  labelEl.focus();

  const range = document.createRange();
  range.selectNodeContents(labelEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finish() {
    labelEl.contentEditable = 'false';
    const newName = labelEl.textContent.trim();
    if (newName) renameGroup(groupId, newName);
    labelEl.removeEventListener('blur', finish);
    labelEl.removeEventListener('keydown', onKey);
    if (callbacks.onGroupChanged) callbacks.onGroupChanged();
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') {
      labelEl.contentEditable = 'false';
      labelEl.removeEventListener('blur', finish);
      labelEl.removeEventListener('keydown', onKey);
    }
  }

  labelEl.addEventListener('blur', finish);
  labelEl.addEventListener('keydown', onKey);
}

// ── Drag & Drop ──
function setupDragDrop(tabEl, tabId) {
  tabEl.draggable = true;

  tabEl.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', tabId);
    e.dataTransfer.effectAllowed = 'move';
    tabEl.classList.add('dragging');
  });

  tabEl.addEventListener('dragend', () => {
    tabEl.classList.remove('dragging');
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.remove('drag-over-left', 'drag-over-right');
    });
  });

  tabEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = tabEl.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const isLeft = e.clientX < midX;

    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.remove('drag-over-left', 'drag-over-right');
    });

    tabEl.classList.add(isLeft ? 'drag-over-left' : 'drag-over-right');
  });

  tabEl.addEventListener('dragleave', () => {
    tabEl.classList.remove('drag-over-left', 'drag-over-right');
  });

  tabEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId === tabId) return;

    tabEl.classList.remove('drag-over-left', 'drag-over-right');

    const tabsContainer = tabEl.parentElement;
    const tabs = [...tabsContainer.querySelectorAll('.tab')];
    const draggedEl = tabs.find((t) => t.dataset.id === draggedId);
    if (!draggedEl) return;

    const rect = tabEl.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;

    if (isLeft) {
      tabsContainer.insertBefore(draggedEl, tabEl);
    } else {
      tabsContainer.insertBefore(draggedEl, tabEl.nextSibling);
    }

    // Sync group order from DOM
    syncGroupOrderFromDom(tabsContainer);

    // Notify of new order
    if (callbacks.onReorder) {
      const newOrder = [...tabsContainer.querySelectorAll('.tab')].map((t) => t.dataset.id);
      callbacks.onReorder(newOrder);
    }
  });
}

function syncGroupOrderFromDom(tabsContainer) {
  const tabEls = [...tabsContainer.querySelectorAll('.tab')];
  for (const [groupId, group] of tabGroups) {
    const ordered = [];
    for (const tabEl of tabEls) {
      if (group.tabIds.includes(tabEl.dataset.id)) {
        ordered.push(tabEl.dataset.id);
      }
    }
    group.tabIds = ordered;
  }
}

// ── Context Menu ──
function setupContextMenu(tabEl, tabId) {
  tabEl.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const meta = tabMeta.get(tabId) || {};
    const currentGroupId = tabToGroup.get(tabId);
    const hasSelection = selectedTabs.size > 1;

    // Build group submenu items
    const groupItems = [];
    if (hasSelection) {
      groupItems.push({ action: 'group-selected', label: 'Group Selected Tabs' });
    }

    // Existing groups to add this tab to
    const existingGroups = [...tabGroups.values()];
    if (existingGroups.length > 0) {
      groupItems.push({ separator: true });
      for (const g of existingGroups) {
        groupItems.push({ action: 'add-to-group', label: `Add to: ${g.label}`, groupId: g.id });
      }
    }

    groupItems.push({ separator: true });
    groupItems.push({ action: 'new-group', label: 'New Group from Tab' });
    if (currentGroupId) {
      groupItems.push({ action: 'remove-from-group', label: 'Remove from Group' });
    }

    const items = [
      { action: 'rename', label: 'Rename' },
      { separator: true },
      { colors: true, activeColor: meta.colorLabel || '' },
      { separator: true },
      ...groupItems,
      { separator: true },
      { action: 'lock', label: meta.locked ? 'Unlock Tab' : 'Lock Tab' },
      { action: 'pin', label: meta.pinned ? 'Unpin Tab' : 'Pin Tab' },
      { separator: true },
      { action: 'moveLeft', label: 'Move Left' },
      { action: 'moveRight', label: 'Move Right' },
      { separator: true },
      { action: 'close', label: 'Close Tab', shortcut: 'Ctrl+W' },
    ];

    const result = await showContextMenu(e.clientX, e.clientY, items);
    if (!result) return;

    switch (result.action) {
      case 'rename':
        startRename(tabEl, tabId);
        break;
      case 'color':
        setColorLabel(tabEl, tabId, result.color);
        break;
      case 'lock':
        toggleLock(tabEl, tabId);
        break;
      case 'pin':
        togglePin(tabEl, tabId);
        break;
      case 'moveLeft':
        if (callbacks.onMoveLeft) callbacks.onMoveLeft(tabId);
        break;
      case 'moveRight':
        if (callbacks.onMoveRight) callbacks.onMoveRight(tabId);
        break;
      case 'close':
        if (callbacks.onClose && !meta.locked && !meta.pinned) callbacks.onClose(tabId);
        break;
      case 'new-group': {
        const gid = createGroup('New Group', GROUP_COLORS[tabGroups.size % GROUP_COLORS.length]);
        addTabToGroup(tabId, gid);
        if (callbacks.onGroupChanged) callbacks.onGroupChanged();
        break;
      }
      case 'add-to-group':
        if (result.groupId) {
          addTabToGroup(tabId, result.groupId);
          if (callbacks.onGroupChanged) callbacks.onGroupChanged();
        }
        break;
      case 'remove-from-group':
        removeTabFromGroup(tabId);
        if (callbacks.onGroupChanged) callbacks.onGroupChanged();
        break;
      case 'group-selected': {
        const gid = createGroup('New Group', GROUP_COLORS[tabGroups.size % GROUP_COLORS.length]);
        for (const tid of selectedTabs) {
          addTabToGroup(tid, gid);
        }
        clearSelection();
        if (callbacks.onGroupChanged) callbacks.onGroupChanged();
        break;
      }
    }
  });
}

// ── Rename ──
function startRename(tabEl, tabId) {
  const titleEl = tabEl.querySelector('.tab-title');
  if (!titleEl) return;

  titleEl.contentEditable = 'true';
  titleEl.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(titleEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finishRename() {
    titleEl.contentEditable = 'false';
    const newName = titleEl.textContent.trim();
    const meta = tabMeta.get(tabId);
    if (meta) meta.label = newName || null;
    if (callbacks.onRename) callbacks.onRename(tabId, newName);
    titleEl.removeEventListener('blur', finishRename);
    titleEl.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishRename();
    }
    if (e.key === 'Escape') {
      titleEl.contentEditable = 'false';
      titleEl.removeEventListener('blur', finishRename);
      titleEl.removeEventListener('keydown', onKey);
    }
  }

  titleEl.addEventListener('blur', finishRename);
  titleEl.addEventListener('keydown', onKey);
}

// ── Color Label ──
function setColorLabel(tabEl, tabId, color) {
  const meta = tabMeta.get(tabId);
  if (meta) meta.colorLabel = color;

  const dot = tabEl.querySelector('.tab-color-dot');
  if (dot) {
    if (color) {
      dot.style.background = color;
      tabEl.setAttribute('data-color', color);
    } else {
      dot.style.background = '';
      tabEl.removeAttribute('data-color');
    }
  }
}

// ── Lock ──
function toggleLock(tabEl, tabId) {
  const meta = tabMeta.get(tabId);
  if (!meta) return;
  meta.locked = !meta.locked;
  tabEl.classList.toggle('locked', meta.locked);
}

// ── Pin ──
function togglePin(tabEl, tabId) {
  const meta = tabMeta.get(tabId);
  if (!meta) return;
  meta.pinned = !meta.pinned;
  tabEl.classList.toggle('pinned', meta.pinned);

  // Move pinned tabs to the left
  if (meta.pinned) {
    const tabsContainer = tabEl.parentElement;
    const firstUnpinned = [...tabsContainer.querySelectorAll('.tab')].find(
      (t) => !t.classList.contains('pinned')
    );
    if (firstUnpinned) {
      tabsContainer.insertBefore(tabEl, firstUnpinned);
    }
  }
}

// ── Process Name ──
function setProcessName(tabId, name) {
  const meta = tabMeta.get(tabId);
  if (meta) meta.processName = name;
}

function getDisplayTitle(tabId, defaultTitle) {
  const meta = tabMeta.get(tabId);
  if (!meta) return defaultTitle;
  if (meta.label) return meta.label;
  if (meta.processName) return meta.processName;
  return defaultTitle;
}

module.exports = {
  initTabManager,
  registerTab,
  unregisterTab,
  getMeta,
  isLocked,
  isPinned,
  setProcessName,
  getDisplayTitle,
  startRename,
  setColorLabel,
  toggleLock,
  togglePin,
  tabMeta,
  // Group exports
  createGroup,
  deleteGroup,
  addTabToGroup,
  removeTabFromGroup,
  getGroupId,
  getGroups,
  getGroup,
  renameGroup,
  setGroupColor,
  toggleGroupCollapse,
  restoreGroups,
  renderGroups,
  // Multi-select exports
  toggleTabSelection,
  getSelectedTabs,
  clearSelection,
};
