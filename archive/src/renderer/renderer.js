const path = require('path');
const appRoot = path.resolve(__dirname, '..', '..');
require('module-alias').addAliases({
  '@data': path.join(appRoot, 'data'),
  '@themes': path.join(appRoot, 'themes'),
  '@main': path.join(appRoot, 'src', 'main'),
  '@preload': path.join(appRoot, 'src', 'preload'),
  '@renderer': path.join(appRoot, 'src', 'renderer'),
});
const { Terminal } = require('@xterm/xterm');
const { FitAddon } = require('@xterm/addon-fit');
const { WebLinksAddon } = require('@xterm/addon-web-links');
const themeEngine = require('@themes/theme-engine');
const profileMod = require('@renderer/profiles');
const searchMod = require('@renderer/search');
const splitPane = require('@renderer/split-pane');
const tabManager = require('@renderer/tab-manager');
const { showContextMenu } = require('@renderer/context-menu');
const commandPalette = require('@renderer/command-palette');
const notifications = require('@renderer/notifications');
const snippetsMod = require('@renderer/snippets');
const sshManager = require('@renderer/ssh-manager');
const terminalExport = require('@renderer/terminal-export');
const settingsPanel = require('@renderer/settings-panel');
const processMonitor = require('@renderer/process-monitor');
const clipboardRing = require('@renderer/clipboard-ring');
const jobTracker = require('@renderer/job-tracker');
const tilingLayouts = require('@renderer/tiling-layouts');
const scratchPad = require('@renderer/scratch-pad');
const commandHistory = require('@renderer/command-history');

function isScratchPadEnabled() {
  const s = settingsPanel.getSettings();
  return s.scratchPadEnabled === true;
}
const sshHealth = require('@renderer/ssh-health');
const paneDrag = require('@renderer/pane-drag');

// ── State ──
// tabs = Map<tabId, { tab, wrapper, rootPane, activePaneId }>
const tabs = new Map();
// Secondary index: terminalId -> { tabId, paneId }
const panesByTerminalId = new Map();

let activeTabId = null;
let tabCounter = 0;

// Zoom state: tabId -> { originalRootPane, zoomedPaneId }
const zoomState = new Map();

// Command duration timers: terminalId -> { name, startTime, intervalId }
const commandTimers = new Map();

// SSH connections: terminalId -> { host, status }
const sshConnections = new Map();

const tabsContainer = document.getElementById('tabs');
const terminalContainer = document.getElementById('terminal-container');

// ── Quake Mode Detection ──
const urlParams = new URLSearchParams(window.location.search);
const isQuakeMode = urlParams.get('mode') === 'quake';
if (isQuakeMode) {
  document.body.classList.add('quake-mode');
}

// ── Key Event Handler (shared) ──
function attachKeyHandler(term) {
  term.attachCustomKeyEventHandler((e) => {
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') return false;
    if (e.altKey && e.key >= '1' && e.key <= '9') return false;
    if (e.ctrlKey && e.key === 't') return false;
    if (e.ctrlKey && e.key === 'w') return false;
    if (e.ctrlKey && e.key === 'Tab') return false;
    // Search: Ctrl+Shift+F
    if (e.ctrlKey && e.shiftKey && e.key === 'F') return false;
    // Split: Ctrl+Shift+D (vertical), Ctrl+Shift+E (horizontal)
    if (e.ctrlKey && e.shiftKey && e.key === 'D') return false;
    if (e.ctrlKey && e.shiftKey && e.key === 'E') return false;
    // Navigate panes: Ctrl+Alt+Arrow
    if (e.ctrlKey && e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return false;
    // Close pane: Ctrl+Shift+W
    if (e.ctrlKey && e.shiftKey && e.key === 'W') return false;
    // Command Palette: Ctrl+Shift+P
    if (e.ctrlKey && e.shiftKey && e.key === 'P') return false;
    // Snippets: Ctrl+Shift+S
    if (e.ctrlKey && e.shiftKey && e.key === 'S') return false;
    // Export Terminal: Ctrl+Shift+X
    if (e.ctrlKey && e.shiftKey && e.key === 'X') return false;
    // Copy/Paste: Ctrl+Shift+C / Ctrl+Shift+V
    if (e.ctrlKey && e.shiftKey && e.key === 'C') return false;
    if (e.ctrlKey && e.shiftKey && e.key === 'V') return false;
    // Zoom: Ctrl+Shift+Z
    if (e.ctrlKey && e.shiftKey && e.key === 'Z') return false;
    // Clipboard Ring: Ctrl+Alt+V
    if (e.ctrlKey && e.altKey && e.key === 'v') return false;
    // Job Tracker: Ctrl+Shift+J
    if (e.ctrlKey && e.shiftKey && e.key === 'J') return false;
    // Scratch Pad: Ctrl+Shift+N
    if (e.ctrlKey && e.shiftKey && e.key === 'N') return false;
    // Command History: Ctrl+Shift+H
    if (e.ctrlKey && e.shiftKey && e.key === 'H') return false;
    return true;
  });
}

// ── Initialize Split Pane Module ──
splitPane.init({
  getTerminalTheme: () => themeEngine.getTerminalTheme(),
  attachKeyHandler,
  getSettings: () => settingsPanel.getSettings(),
});

// ── Tab Manager Callbacks ──
tabManager.initTabManager({
  onClose: (tabId) => closeTab(tabId),
  onSwitch: (tabId) => switchTab(tabId),
  onReorder: (orderedIds) => {
    scheduleSessionSave();
  },
  onMoveLeft: (tabId) => moveTab(tabId, -1),
  onMoveRight: (tabId) => moveTab(tabId, 1),
  onGroupChanged: () => {
    tabManager.renderGroups(tabsContainer);
    scheduleSessionSave();
  },
});

// ── Tab Element Factory ──
function createTabElement(tabId, label) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.id = tabId;
  tab.innerHTML = `
    <span class="tab-color-dot"></span>
    <span class="tab-title">${label}</span>
    <svg class="tab-lock" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
    <button class="tab-close" title="Close">
      <svg width="10" height="10" viewBox="0 0 12 12">
        <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/>
        <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </button>
  `;
  tab.addEventListener('click', (e) => {
    if (e.ctrlKey && !e.target.closest('.tab-close')) {
      tabManager.toggleTabSelection(tabId);
      return;
    }
    if (!e.target.closest('.tab-close')) switchTab(tabId);
  });
  tab.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!tabManager.isLocked(tabId) && !tabManager.isPinned(tabId)) closeTab(tabId);
  });
  return tab;
}

// ── Create Tab ──
async function createTab(profileId) {
  const id = `tab-${++tabCounter}`;
  splitPane.setTermIdCounter(tabCounter * 100); // avoid ID collisions between tabs

  // Look up profile for font overrides
  let fontOverrides = null;
  if (profileId) {
    const profile = profileMod.getProfile(profileId);
    if (profile && profile.font) fontOverrides = profile.font;
  }

  // Create tab element
  const tab = createTabElement(id, `Terminal ${tabCounter}`);
  tabsContainer.appendChild(tab);
  tabManager.registerTab(id, tab);

  // Create terminal wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-wrapper';
  wrapper.dataset.id = id;
  terminalContainer.appendChild(wrapper);

  // Create root pane (leaf)
  const rootPane = splitPane.createPaneLeaf(profileId, fontOverrides);
  wrapper.appendChild(rootPane.wrapper);

  // Register pane-focus event
  wrapper.addEventListener('pane-focus', (e) => {
    const tabEntry = tabs.get(id);
    if (tabEntry && tabEntry.activePaneId !== e.detail.paneId) {
      tabEntry.activePaneId = e.detail.paneId;
      splitPane.focusPane(tabEntry.rootPane, e.detail.paneId);
    }
  });

  // Create scratch pad (if enabled)
  if (isScratchPadEnabled()) {
    scratchPad.createForTab(id, wrapper);
  }
  wrapper.addEventListener('scratch-pad-resize', () => {
    const te = tabs.get(id);
    if (te) requestAnimationFrame(() => splitPane.refitPaneTree(te.rootPane));
  });

  // Store tab data
  tabs.set(id, { tab, wrapper, rootPane, activePaneId: rootPane.id });

  // Register in secondary index
  panesByTerminalId.set(rootPane.terminalId, { tabId: id, paneId: rootPane.id });

  // Attach drag handle for pane drag-drop
  paneDrag.attachDragHandle(rootPane);

  // Create PTY
  await window.terminalAPI.create(rootPane.terminalId, profileId);
  startLoggingIfEnabled(rootPane.terminalId);

  // Activate
  switchTab(id);

  // Fit
  requestAnimationFrame(() => {
    splitPane.refitPaneTree(rootPane);
    const leaf = splitPane.getFirstLeaf(rootPane);
    if (leaf) {
      window.terminalAPI.resize(leaf.terminalId, leaf.term.cols, leaf.term.rows);
    }
  });

  scheduleSessionSave();
  return id;
}

function switchTab(id) {
  if (activeTabId === id) return;

  // Deactivate current
  if (activeTabId) {
    const current = tabs.get(activeTabId);
    if (current) {
      current.tab.classList.remove('active');
      current.wrapper.classList.remove('active');
    }
  }

  // Activate new
  const next = tabs.get(id);
  if (next) {
    next.tab.classList.add('active');
    next.wrapper.classList.add('active');
    activeTabId = id;

    // Clear notification badge
    notifications.onTabSwitch(id);

    requestAnimationFrame(() => {
      splitPane.refitPaneTree(next.rootPane);
      const activeLeaf = splitPane.findLeaf(next.rootPane, next.activePaneId);
      if (activeLeaf) {
        activeLeaf.term.focus();
      } else {
        const first = splitPane.getFirstLeaf(next.rootPane);
        if (first) first.term.focus();
      }
    });
  }

  updateEmptyState();
  scheduleSessionSave();
}

function closeTab(id) {
  const entry = tabs.get(id);
  if (!entry) return;

  // Check lock/pin
  if (tabManager.isLocked(id) || tabManager.isPinned(id)) return;

  // Dispose all panes (kills PTYs)
  const leaves = splitPane.collectLeaves(entry.rootPane);
  leaves.forEach((leaf) => {
    panesByTerminalId.delete(leaf.terminalId);
    processMonitor.removeTerminal(leaf.terminalId);
  });
  splitPane.disposePaneTree(entry.rootPane);

  // Remove scratch pad
  scratchPad.removeForTab(id);

  // Remove DOM
  entry.tab.remove();
  entry.wrapper.remove();
  tabs.delete(id);
  tabManager.unregisterTab(id);

  // Switch to another tab
  if (activeTabId === id) {
    activeTabId = null;
    const remaining = [...tabs.keys()];
    if (remaining.length > 0) {
      switchTab(remaining[remaining.length - 1]);
    }
  }

  updateEmptyState();
  scheduleSessionSave();
}

function updateEmptyState() {
  let emptyState = terminalContainer.querySelector('.empty-state');

  if (tabs.size === 0) {
    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <p>Press <kbd>Ctrl+T</kbd> for a new terminal or click <kbd>+</kbd></p>
      `;
      terminalContainer.appendChild(emptyState);
    }
  } else if (emptyState) {
    emptyState.remove();
  }
}

// ── Split Pane Operations ──
async function splitCurrentPane(direction) {
  if (!activeTabId) return;
  const tabEntry = tabs.get(activeTabId);
  if (!tabEntry) return;

  const currentLeaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
  if (!currentLeaf) return;

  const { branch, newLeaf } = splitPane.splitPane(currentLeaf, direction);

  // Update tree: replace the leaf in the tree with the new branch
  if (tabEntry.rootPane.id === currentLeaf.id) {
    // Root was the leaf
    tabEntry.rootPane = branch;
    tabEntry.wrapper.appendChild(branch.container);
  } else {
    tabEntry.rootPane = splitPane.replaceNode(tabEntry.rootPane, currentLeaf.id, branch);
  }

  // Register new pane in secondary index
  panesByTerminalId.set(newLeaf.terminalId, { tabId: activeTabId, paneId: newLeaf.id });

  // Attach drag handle
  paneDrag.attachDragHandle(newLeaf);

  // Create PTY for new pane (inherit CWD from current pane)
  let cwdOverride = null;
  try { cwdOverride = await window.terminalAPI.getCwd(currentLeaf.terminalId); } catch (e) {}
  await window.terminalAPI.create(newLeaf.terminalId, null, cwdOverride);
  startLoggingIfEnabled(newLeaf.terminalId);

  // Focus new pane
  tabEntry.activePaneId = newLeaf.id;
  splitPane.focusPane(tabEntry.rootPane, newLeaf.id);

  requestAnimationFrame(() => {
    splitPane.refitPaneTree(tabEntry.rootPane);
  });

  scheduleSessionSave();
}

function closeFocusedPane() {
  if (!activeTabId) return;
  const tabEntry = tabs.get(activeTabId);
  if (!tabEntry) return;

  const leaves = splitPane.collectLeaves(tabEntry.rootPane);
  if (leaves.length <= 1) {
    // Last pane — close the tab
    closeTab(activeTabId);
    return;
  }

  const currentLeaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
  if (!currentLeaf) return;

  // Remove from secondary index
  panesByTerminalId.delete(currentLeaf.terminalId);
  processMonitor.removeTerminal(currentLeaf.terminalId);
  searchMod.removeSearchAddon(currentLeaf.terminalId);

  // Kill PTY and dispose terminal
  window.terminalAPI.kill(currentLeaf.terminalId);
  currentLeaf.term.dispose();
  currentLeaf.wrapper.remove();

  // Close pane in tree
  const result = splitPane.closePane(tabEntry.rootPane, currentLeaf.id);
  if (result) {
    if (result.parentId === tabEntry.rootPane.id) {
      tabEntry.rootPane = result.sibling;
    } else {
      tabEntry.rootPane = splitPane.replaceNode(tabEntry.rootPane, result.parentId, result.sibling);
    }
  }

  // Focus first remaining pane
  const firstLeaf = splitPane.getFirstLeaf(tabEntry.rootPane);
  if (firstLeaf) {
    tabEntry.activePaneId = firstLeaf.id;
    splitPane.focusPane(tabEntry.rootPane, firstLeaf.id);
  }

  requestAnimationFrame(() => {
    splitPane.refitPaneTree(tabEntry.rootPane);
  });

  scheduleSessionSave();
}

function navigatePanes(direction) {
  if (!activeTabId) return;
  const tabEntry = tabs.get(activeTabId);
  if (!tabEntry) return;

  const dirMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  const target = splitPane.navigatePane(tabEntry.rootPane, tabEntry.activePaneId, dirMap[direction] || direction);
  if (target) {
    tabEntry.activePaneId = target.id;
    splitPane.focusPane(tabEntry.rootPane, target.id);
  }
}

// ── Terminal Logging Helper (F9) ──
function startLoggingIfEnabled(terminalId) {
  const s = settingsPanel.getSettings();
  if (!s.loggingEnabled) return;
  const logDir = s.logDirectory || path.join(require('os').homedir(), '.glaceon-terminal', 'logs');
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const logPath = path.join(logDir, dateStr, `${terminalId}-${timeStr}.log`);
  window.loggingAPI.start(terminalId, logPath);
}

// ── Zoom ──
function toggleZoom() {
  if (!activeTabId) return;
  const tabEntry = tabs.get(activeTabId);
  if (!tabEntry) return;

  const zoom = zoomState.get(activeTabId);
  if (zoom) {
    // Unzoom: restore original root pane
    tabEntry.wrapper.innerHTML = '';
    tabEntry.wrapper.appendChild(splitPane.getDomElement(zoom.originalRootPane));
    tabEntry.rootPane = zoom.originalRootPane;
    zoomState.delete(activeTabId);
    tabEntry.tab.classList.remove('zoomed');
    requestAnimationFrame(() => {
      splitPane.refitPaneTree(tabEntry.rootPane);
      const leaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
      if (leaf) leaf.term.focus();
    });
  } else {
    // Zoom: show only the active pane
    const leaves = splitPane.collectLeaves(tabEntry.rootPane);
    if (leaves.length <= 1) return; // no point zooming single pane

    const activeLeaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
    if (!activeLeaf) return;

    zoomState.set(activeTabId, { originalRootPane: tabEntry.rootPane, zoomedPaneId: activeLeaf.id });
    tabEntry.wrapper.innerHTML = '';
    tabEntry.wrapper.appendChild(activeLeaf.wrapper);
    activeLeaf.wrapper.style.flex = '';
    tabEntry.tab.classList.add('zoomed');
    requestAnimationFrame(() => {
      splitPane.refitPaneTree(activeLeaf);
      activeLeaf.term.focus();
    });
  }
}

// ── Search ──
function toggleSearch() {
  if (!activeTabId) return;
  const tabEntry = tabs.get(activeTabId);
  if (!tabEntry) return;

  const activeLeaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
  if (!activeLeaf) return;

  searchMod.toggleSearchBar(activeLeaf.wrapper, activeLeaf.terminalId);
}

// ── Move Tab ──
function moveTab(tabId, direction) {
  const tabEl = tabsContainer.querySelector(`.tab[data-id="${tabId}"]`);
  if (!tabEl) return;

  if (direction === -1 && tabEl.previousElementSibling) {
    tabsContainer.insertBefore(tabEl, tabEl.previousElementSibling);
  } else if (direction === 1 && tabEl.nextElementSibling) {
    tabsContainer.insertBefore(tabEl.nextElementSibling, tabEl);
  }
  scheduleSessionSave();
}

// ── Receive PTY Data ──
window.terminalAPI.onData((id, data) => {
  const mapping = panesByTerminalId.get(id);
  if (!mapping) return;
  const tabEntry = tabs.get(mapping.tabId);
  if (!tabEntry) return;
  const leaf = splitPane.findLeafByTerminalId(tabEntry.rootPane, id);
  if (leaf) leaf.term.write(data);

  // Notify badge system
  notifications.onTerminalOutput(id, data);
});

// ── Handle PTY Exit ──
window.terminalAPI.onExit((id, exitCode) => {
  // Clean up command timer
  const timer = commandTimers.get(id);
  if (timer) { clearInterval(timer.intervalId); commandTimers.delete(id); }
  // Record exit in command history
  commandHistory.recordTerminalExit(id, exitCode);
  // Clean up SSH health
  sshHealth.unregisterSsh(id);
  // Clean up SSH badge
  sshConnections.delete(id);
  // Stop logging
  if (window.loggingAPI) window.loggingAPI.stop(id);

  const mapping = panesByTerminalId.get(id);
  if (!mapping) return;
  const tabEntry = tabs.get(mapping.tabId);
  if (!tabEntry) return;

  // Remove SSH badge from tab
  const sshBadge = tabEntry.tab.querySelector('.ssh-status-badge');
  if (sshBadge) sshBadge.remove();

  const leaf = splitPane.findLeafByTerminalId(tabEntry.rootPane, id);
  if (leaf) {
    leaf.term.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`);
    const leaves = splitPane.collectLeaves(tabEntry.rootPane);
    if (leaves.length <= 1) {
      // Single pane — close the whole tab after delay
      setTimeout(() => closeTab(mapping.tabId), 1500);
    } else {
      // Multi-pane — just close this pane after delay
      setTimeout(() => {
        panesByTerminalId.delete(id);
        processMonitor.removeTerminal(id);
        leaf.term.dispose();
        leaf.wrapper.remove();
        const result = splitPane.closePane(tabEntry.rootPane, leaf.id);
        if (result) {
          if (result.parentId === tabEntry.rootPane.id) {
            tabEntry.rootPane = result.sibling;
          } else {
            tabEntry.rootPane = splitPane.replaceNode(tabEntry.rootPane, result.parentId, result.sibling);
          }
        }
        const firstLeaf = splitPane.getFirstLeaf(tabEntry.rootPane);
        if (firstLeaf) {
          tabEntry.activePaneId = firstLeaf.id;
          splitPane.focusPane(tabEntry.rootPane, firstLeaf.id);
        }
        splitPane.refitPaneTree(tabEntry.rootPane);
      }, 1500);
    }
  }
});

// ── Process Name Updates ──
window.terminalAPI.onProcessName((id, name) => {
  const mapping = panesByTerminalId.get(id);
  if (!mapping) return;

  const tabEntry = tabs.get(mapping.tabId);
  if (!tabEntry) return;

  // Update tab title
  tabManager.setProcessName(mapping.tabId, name);
  const displayTitle = tabManager.getDisplayTitle(mapping.tabId, `Terminal`);
  const titleEl = tabEntry.tab.querySelector('.tab-title');
  if (titleEl && !titleEl.isContentEditable) {
    titleEl.textContent = displayTitle;
  }

  // Remove SSH badge when process is no longer ssh
  if (name !== 'ssh' && sshConnections.has(id)) {
    sshConnections.delete(id);
    sshHealth.unregisterSsh(id);
    const badge = tabEntry.tab.querySelector('.ssh-status-badge');
    if (badge) badge.remove();
  }
});

// ── SSH Detection (F3) ──
window.terminalAPI.onSshDetected((id, host) => {
  const mapping = panesByTerminalId.get(id);
  if (!mapping) return;
  sshConnections.set(id, { host, status: 'connected' });
  sshHealth.registerSshCommand(id, host, null);

  const tabEntry = tabs.get(mapping.tabId);
  if (!tabEntry) return;
  let badge = tabEntry.tab.querySelector('.ssh-status-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'ssh-status-badge';
    tabEntry.tab.insertBefore(badge, tabEntry.tab.querySelector('.tab-close'));
  }
  badge.textContent = host;
  badge.classList.remove('disconnected');
});

// ── Command Duration Timer (F5) ──
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

window.terminalAPI.onCommandRunning((id, name, startTime) => {
  const mapping = panesByTerminalId.get(id);
  if (!mapping) return;
  const tabEntry = tabs.get(mapping.tabId);
  if (!tabEntry) return;

  if (!commandTimers.has(id)) {
    const leaf = splitPane.findLeafByTerminalId(tabEntry.rootPane, id);
    if (!leaf) return;

    // Record in command history
    const buf = leaf.term.buffer.active;
    const bufferLine = buf.baseY + buf.cursorY;
    commandHistory.recordCommandStart(id, mapping.tabId, name, startTime, bufferLine);

    let badge = leaf.wrapper.querySelector('.cmd-timer-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cmd-timer-badge';
      leaf.wrapper.appendChild(badge);
    }

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      badge.textContent = `${name}  ${formatDuration(elapsed)}`;
    }, 1000);

    badge.textContent = `${name}  0s`;
    commandTimers.set(id, { name, startTime, intervalId });
  }
});

window.terminalAPI.onCommandDone((id, name, durationMs) => {
  // Record in command history
  commandHistory.recordCommandDone(id, name, durationMs);

  const timer = commandTimers.get(id);
  if (timer) {
    clearInterval(timer.intervalId);
    commandTimers.delete(id);
  }

  const mapping = panesByTerminalId.get(id);
  if (!mapping) return;
  const tabEntry = tabs.get(mapping.tabId);
  if (!tabEntry) return;
  const leaf = splitPane.findLeafByTerminalId(tabEntry.rootPane, id);
  if (leaf) {
    const badge = leaf.wrapper.querySelector('.cmd-timer-badge');
    if (badge) badge.remove();
  }

  // System notification for long commands
  if (durationMs > 30000 && window.notificationAPI) {
    window.notificationAPI.show('Command Finished', `"${name}" completed in ${formatDuration(durationMs)}`);
  }
});

// ── Process Stats (F4) ──
window.terminalAPI.onProcessStats((id, stats) => {
  processMonitor.onProcessStats(id, stats);
});

// ── Window Resize ──
let resizeRaf = null;
window.addEventListener('resize', () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    tabs.forEach((entry) => {
      if (entry.wrapper.classList.contains('active')) {
        splitPane.refitPaneTree(entry.rootPane);
      }
    });
    resizeRaf = null;
  });
});

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', (e) => {
  // Ctrl+T: New tab
  if (e.ctrlKey && !e.shiftKey && e.key === 't') {
    e.preventDefault();
    createTab();
  }
  // Ctrl+W: Close current tab (skip locked/pinned)
  if (e.ctrlKey && !e.shiftKey && e.key === 'w') {
    e.preventDefault();
    if (activeTabId && !tabManager.isLocked(activeTabId) && !tabManager.isPinned(activeTabId)) {
      closeTab(activeTabId);
    }
  }
  // Ctrl+Tab: Next tab
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    const ids = [...tabs.keys()];
    if (ids.length < 2) return;
    const idx = ids.indexOf(activeTabId);
    const nextIdx = e.shiftKey
      ? (idx - 1 + ids.length) % ids.length
      : (idx + 1) % ids.length;
    switchTab(ids[nextIdx]);
  }
  // Ctrl+1-9 or Alt+1-9: Switch to tab
  if ((e.ctrlKey || e.altKey) && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const ids = [...tabs.keys()];
    const idx = parseInt(e.key) - 1;
    if (idx < ids.length) switchTab(ids[idx]);
  }
  // Ctrl+Shift+F: Search
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    toggleSearch();
  }
  // Ctrl+Shift+D: Split vertical
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    splitCurrentPane('vertical');
  }
  // Ctrl+Shift+E: Split horizontal
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    splitCurrentPane('horizontal');
  }
  // Ctrl+Shift+W: Close focused pane
  if (e.ctrlKey && e.shiftKey && e.key === 'W') {
    e.preventDefault();
    closeFocusedPane();
  }
  // Ctrl+Alt+Arrow: Navigate panes
  if (e.ctrlKey && e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    navigatePanes(e.key);
  }
  // Ctrl+Shift+P: Command Palette
  if (e.ctrlKey && e.shiftKey && e.key === 'P') {
    e.preventDefault();
    commandPalette.togglePalette();
  }
  // Ctrl+Shift+S: Snippet Manager
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    snippetsMod.toggle();
  }
  // Ctrl+Shift+X: Export Terminal
  if (e.ctrlKey && e.shiftKey && e.key === 'X') {
    e.preventDefault();
    exportActiveTerminal();
  }
  // Ctrl+Shift+C: Copy selection
  if (e.ctrlKey && e.shiftKey && e.key === 'C') {
    e.preventDefault();
    if (!activeTabId) return;
    const tabEntry = tabs.get(activeTabId);
    if (!tabEntry) return;
    const leaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
    if (leaf) {
      const sel = leaf.term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel);
        clipboardRing.push(sel);
      }
    }
  }
  // Ctrl+Shift+V: Paste
  if (e.ctrlKey && e.shiftKey && e.key === 'V') {
    e.preventDefault();
    if (!activeTabId) return;
    const tabEntry = tabs.get(activeTabId);
    if (!tabEntry) return;
    const leaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
    if (leaf) {
      navigator.clipboard.readText().then((text) => {
        if (text) leaf.term.paste(text);
      });
    }
  }
  // Ctrl+Shift+Z: Zoom/Unzoom pane
  if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
    e.preventDefault();
    toggleZoom();
  }
  // Ctrl+Alt+V: Clipboard Ring
  if (e.ctrlKey && e.altKey && e.key === 'v') {
    e.preventDefault();
    clipboardRing.openPopup();
  }
  // Ctrl+Shift+J: Job Tracker
  if (e.ctrlKey && e.shiftKey && e.key === 'J') {
    e.preventDefault();
    jobTracker.toggle();
  }
  // Ctrl+Shift+N: Scratch Pad
  if (e.ctrlKey && e.shiftKey && e.key === 'N') {
    e.preventDefault();
    if (activeTabId && isScratchPadEnabled()) scratchPad.toggle(activeTabId);
  }
  // Ctrl+Shift+H: Command History
  if (e.ctrlKey && e.shiftKey && e.key === 'H') {
    e.preventDefault();
    commandHistory.toggle();
  }
});

// ── Apply Tiling Layout (F7) ──
async function applyLayout(layoutId) {
  if (!activeTabId) return;
  const tabEntry = tabs.get(activeTabId);
  if (!tabEntry) return;

  // Unzoom first if zoomed
  if (zoomState.has(activeTabId)) toggleZoom();

  const layout = tilingLayouts.getLayout(layoutId);
  if (!layout) return;

  const treeDef = layout.build();
  const neededLeaves = tilingLayouts.countLeaves(treeDef);
  const existingLeaves = splitPane.collectLeaves(tabEntry.rootPane);

  // Collect CWD from first existing leaf for new panes to inherit
  let inheritCwd = null;
  if (existingLeaves.length > 0) {
    try { inheritCwd = await window.terminalAPI.getCwd(existingLeaves[0].terminalId); } catch (e) {}
  }

  // Dispose all existing panes and PTYs
  for (const leaf of existingLeaves) {
    panesByTerminalId.delete(leaf.terminalId);
    processMonitor.removeTerminal(leaf.terminalId);
    searchMod.removeSearchAddon(leaf.terminalId);
    window.terminalAPI.kill(leaf.terminalId);
    if (window.loggingAPI) window.loggingAPI.stop(leaf.terminalId);
    leaf.term.dispose();
  }

  // Build serialized tree for deserializePaneTree
  function buildSerialized(def) {
    if (def.type === 'leaf') {
      return {
        type: 'leaf',
        id: splitPane.generatePaneId(),
        terminalId: splitPane.generateTerminalId(),
        profileId: null,
        cwd: null,
        buffer: '',
      };
    }
    if (def.type === 'branch') {
      return {
        type: 'branch',
        id: splitPane.generatePaneId(),
        direction: def.direction,
        ratio: def.ratio,
        children: def.children.map(buildSerialized),
      };
    }
  }

  const serialized = buildSerialized(treeDef);
  const result = splitPane.deserializePaneTree(serialized);
  if (!result) return;

  const { node: newRoot, leaves } = result;

  // Mount new tree
  tabEntry.wrapper.innerHTML = '';
  tabEntry.wrapper.appendChild(splitPane.getDomElement(newRoot));
  tabEntry.rootPane = newRoot;

  // Set active pane to first leaf
  const firstLeaf = splitPane.getFirstLeaf(newRoot);
  if (firstLeaf) {
    tabEntry.activePaneId = firstLeaf.id;
    splitPane.focusPane(newRoot, firstLeaf.id);
  }

  // Create PTYs for all new leaves and attach drag handles
  for (const { leaf } of leaves) {
    panesByTerminalId.set(leaf.terminalId, { tabId: activeTabId, paneId: leaf.id });
    paneDrag.attachDragHandle(leaf);
    await window.terminalAPI.create(leaf.terminalId, null, inheritCwd);
    startLoggingIfEnabled(leaf.terminalId);
  }

  // Re-create scratch pad (it was removed when wrapper was cleared)
  scratchPad.removeForTab(activeTabId);
  if (isScratchPadEnabled()) {
    scratchPad.createForTab(activeTabId, tabEntry.wrapper);
  }

  requestAnimationFrame(() => {
    splitPane.refitPaneTree(tabEntry.rootPane);
  });

  scheduleSessionSave();
}

// ── Export Active Terminal ──
function exportActiveTerminal() {
  if (!activeTabId) return;
  const tabEntry = tabs.get(activeTabId);
  if (!tabEntry) return;
  const activeLeaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
  if (activeLeaf) terminalExport.exportTerminal(activeLeaf.term);
}

// ── Window Controls ──
document.getElementById('btn-minimize')?.addEventListener('click', () => window.windowAPI.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => window.windowAPI.maximize());
document.getElementById('btn-close')?.addEventListener('click', () => window.windowAPI.close());

// ── Split Buttons ──
document.getElementById('btn-split-h')?.addEventListener('click', () => splitCurrentPane('horizontal'));
document.getElementById('btn-split-v')?.addEventListener('click', () => splitCurrentPane('vertical'));

// ── Titlebar Tool Buttons ──
document.getElementById('btn-ssh')?.addEventListener('click', () => sshManager.toggle());
document.getElementById('btn-snippets')?.addEventListener('click', () => snippetsMod.toggle());
document.getElementById('titlebar-command-bar')?.addEventListener('click', () => commandPalette.togglePalette());
document.getElementById('btn-settings')?.addEventListener('click', () => settingsPanel.toggle());

// ── Terminal Pane Right-Click Context Menu ──
terminalContainer.addEventListener('contextmenu', async (e) => {
  const paneEl = e.target.closest('.pane');
  if (!paneEl) return;
  e.preventDefault();
  e.stopPropagation();

  const paneId = paneEl.dataset.paneId;
  if (!activeTabId) return;
  const tabEntry = tabs.get(activeTabId);
  if (!tabEntry) return;

  // Focus this pane on right-click
  tabEntry.activePaneId = paneId;
  splitPane.focusPane(tabEntry.rootPane, paneId);

  const leaves = splitPane.collectLeaves(tabEntry.rootPane);
  const hasMultiplePanes = leaves.length > 1;

  const items = [
    { action: 'split-h', label: 'Split Horizontal', shortcut: 'Ctrl+Shift+E' },
    { action: 'split-v', label: 'Split Vertical', shortcut: 'Ctrl+Shift+D' },
    { separator: true },
    { action: 'search', label: 'Find', shortcut: 'Ctrl+Shift+F' },
    { separator: true },
    { action: 'copy', label: 'Copy' },
    { action: 'paste', label: 'Paste' },
    { separator: true },
    { action: 'export', label: 'Export Terminal', shortcut: 'Ctrl+Shift+X' },
    { action: 'clear', label: 'Clear Terminal' },
    ...(hasMultiplePanes ? [
      { separator: true },
      { action: 'close-pane', label: 'Close Pane', shortcut: 'Ctrl+Shift+W' },
    ] : []),
  ];

  const result = await showContextMenu(e.clientX, e.clientY, items);
  if (!result) return;

  const leaf = splitPane.findLeaf(tabEntry.rootPane, paneId);
  if (!leaf) return;

  switch (result.action) {
    case 'split-h':
      splitCurrentPane('horizontal');
      break;
    case 'split-v':
      splitCurrentPane('vertical');
      break;
    case 'search':
      toggleSearch();
      break;
    case 'copy': {
      const sel = leaf.term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel);
        clipboardRing.push(sel);
      }
      break;
    }
    case 'paste': {
      const text = await navigator.clipboard.readText();
      if (text) leaf.term.paste(text);
      break;
    }
    case 'export':
      terminalExport.exportTerminal(leaf.term);
      break;
    case 'clear':
      leaf.term.clear();
      break;
    case 'close-pane':
      closeFocusedPane();
      break;
  }
});

// ── New Tab Button ──
const newTabBtn = document.getElementById('btn-new-tab');
newTabBtn?.addEventListener('click', () => createTab());

// Right-click on new-tab button shows profile selector
newTabBtn?.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  profileMod.showProfileSelector(newTabBtn);
});

// Long-press on new-tab button
let longPressTimer;
newTabBtn?.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  longPressTimer = setTimeout(() => {
    profileMod.showProfileSelector(newTabBtn);
  }, 500);
});
newTabBtn?.addEventListener('mouseup', () => clearTimeout(longPressTimer));
newTabBtn?.addEventListener('mouseleave', () => clearTimeout(longPressTimer));

// Profile selector callback
profileMod.setOnProfileSelect((profileId) => {
  createTab(profileId);
});

// ── Theme Engine: provide terminal list for live theme updates ──
// Expose a getter that collects all terminal instances from the pane trees
function getAllTerminalEntries() {
  const entries = [];
  tabs.forEach((tabEntry) => {
    const leaves = splitPane.collectLeaves(tabEntry.rootPane);
    leaves.forEach((leaf) => entries.push({ term: leaf.term }));
  });
  return entries;
}

// Override setTerminalsList to use a Proxy-like dynamic approach
const terminalProxy = new Proxy([], {
  get(target, prop) {
    const entries = getAllTerminalEntries();
    if (prop === 'forEach') return entries.forEach.bind(entries);
    if (prop === 'length') return entries.length;
    return entries[prop];
  },
});
themeEngine.setTerminalsList(terminalProxy);

// ── Reload All Settings (after cloud sync pull) ──
async function reloadAllSettings() {
  const savedThemeId = await window.settingsAPI.get('activeThemeId');
  if (savedThemeId) themeEngine.applyTheme(savedThemeId);

  const savedSettings = await window.settingsAPI.get('settings');
  if (savedSettings && savedSettings.terminalOpacity != null) {
    themeEngine.applyOpacity(savedSettings.terminalOpacity);
  }

  const savedBg = await window.settingsAPI.get('background');
  if (savedBg) settingsPanel.applyBackground(savedBg);

  await profileMod.loadProfiles();
  notifications.updateSettings(savedSettings);
  await settingsPanel.loadSettings();
}

// ── Auto-push proxy on settingsAPI.set ──
const originalSettingsSet = window.settingsAPI.set;
window.settingsAPI.set = (key, value) => {
  originalSettingsSet(key, value);
  if (key !== 'cloudSync' && key !== 'lastSyncedAt') {
    settingsPanel.triggerAutoSync();
  }
};

// ── Handle sync:configUpdated broadcast ──
if (window.syncAPI) {
  window.syncAPI.onConfigUpdated(() => reloadAllSettings());
}

// ── Encryption Unlock ──
async function checkEncryptionUnlock() {
  if (!window.encryptionAPI) return;
  const status = await window.encryptionAPI.getStatus();
  if (!status.isEnabled || status.isUnlocked) return;

  // IAM key source auto-unlocks on the main process side — re-check
  if (status.keySource === 'iam') return;

  // Show unlock modal for custom key
  return new Promise((resolve) => {
    const modal = document.getElementById('encryption-unlock-modal');
    if (!modal) { resolve(); return; }

    modal.innerHTML = `
      <div style="position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px)">
        <div style="background:var(--glass-bg, rgba(30,30,46,0.92));border:1px solid var(--glass-border-strong, rgba(255,255,255,0.12));border-radius:16px;padding:32px 36px;min-width:340px;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.5);text-align:center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #7aa2f7)" stroke-width="2" style="margin-bottom:12px">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <h3 style="color:var(--text-primary, #c0caf5);margin:0 0 6px;font-size:16px;font-weight:600">Vault Locked</h3>
          <p style="color:var(--text-secondary, #565f89);margin:0 0 20px;font-size:13px">Enter your master key to unlock encrypted settings</p>
          <input type="password" id="unlock-password-input" placeholder="Master key" autocomplete="off"
            style="width:100%;box-sizing:border-box;padding:10px 14px;border-radius:8px;border:1px solid var(--glass-border-strong, rgba(255,255,255,0.12));background:var(--glass-tab, rgba(255,255,255,0.06));color:var(--text-primary, #c0caf5);font-size:14px;outline:none;margin-bottom:8px" />
          <p id="unlock-error" style="color:#f7768e;font-size:12px;margin:0 0 12px;min-height:16px"></p>
          <button id="unlock-submit-btn"
            style="width:100%;padding:10px;border:none;border-radius:8px;background:var(--accent, #7aa2f7);color:#1a1b26;font-weight:600;font-size:14px;cursor:pointer">
            Unlock
          </button>
        </div>
      </div>
    `;

    const input = modal.querySelector('#unlock-password-input');
    const errorEl = modal.querySelector('#unlock-error');
    const btn = modal.querySelector('#unlock-submit-btn');

    async function tryUnlock() {
      const pw = input.value;
      if (!pw) { errorEl.textContent = 'Please enter your master key'; return; }
      btn.textContent = 'Unlocking...';
      btn.disabled = true;
      const result = await window.encryptionAPI.unlock(pw);
      if (result.success) {
        modal.innerHTML = '';
        resolve();
      } else {
        errorEl.textContent = result.error || 'Incorrect key';
        btn.textContent = 'Unlock';
        btn.disabled = false;
        input.value = '';
        input.focus();
      }
    }

    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
    setTimeout(() => input.focus(), 100);
  });
}

// ── Session Save/Restore ──
let sessionSaveTimer = null;

async function collectSessionState() {
  // Collect all terminal IDs
  const allTerminalIds = [];
  tabs.forEach((entry) => {
    const leaves = splitPane.collectLeaves(entry.rootPane);
    leaves.forEach((leaf) => allTerminalIds.push(leaf.terminalId));
  });

  // Batch CWD collection
  const cwdMap = await window.sessionAPI.collectCwds(allTerminalIds);

  // Serialize tabs
  const serializedTabs = [];
  const tabIds = [...tabs.keys()];
  for (const tabId of tabIds) {
    const entry = tabs.get(tabId);
    if (!entry) continue;
    const meta = tabManager.getMeta(tabId) || {};
    serializedTabs.push({
      id: tabId,
      meta: {
        label: meta.label || null,
        colorLabel: meta.colorLabel || '',
        locked: meta.locked || false,
        pinned: meta.pinned || false,
      },
      groupId: tabManager.getGroupId ? tabManager.getGroupId(tabId) : null,
      rootPane: splitPane.serializePaneTree(entry.rootPane, cwdMap),
      activePaneId: entry.activePaneId,
      scratchPad: scratchPad.getForTab(tabId),
    });
  }

  // Serialize groups
  const groups = tabManager.getGroups ? tabManager.getGroups() : [];

  return {
    tabs: serializedTabs,
    activeTabId,
    tabCounter,
    tabGroups: groups,
  };
}

function scheduleSessionSave() {
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(async () => {
    try {
      const settings = settingsPanel.getSettings();
      if (settings.restoreSession === false) return;
      const state = await collectSessionState();
      window.settingsAPI.set('session', state);
    } catch (e) {
      // silent save failure
    }
  }, 2000);
}

async function restoreSession() {
  const settings = settingsPanel.getSettings();
  if (settings.restoreSession === false) return false;

  const session = await window.settingsAPI.get('session');
  if (!session || !session.tabs || session.tabs.length === 0) return false;

  // Restore tab counter
  tabCounter = session.tabCounter || 0;

  // Restore groups
  if (session.tabGroups && tabManager.restoreGroups) {
    tabManager.restoreGroups(session.tabGroups);
  }

  // Restore each tab
  for (const savedTab of session.tabs) {
    if (!savedTab.rootPane) continue;

    const tabId = savedTab.id;

    // Create tab element
    const displayLabel = savedTab.meta?.label || `Terminal`;
    const tab = createTabElement(tabId, displayLabel);
    tabsContainer.appendChild(tab);
    tabManager.registerTab(tabId, tab);

    // Apply meta
    if (savedTab.meta) {
      const meta = tabManager.getMeta(tabId);
      if (meta) {
        meta.label = savedTab.meta.label;
        meta.colorLabel = savedTab.meta.colorLabel;
        meta.locked = savedTab.meta.locked;
        meta.pinned = savedTab.meta.pinned;
      }
      if (savedTab.meta.colorLabel) {
        tabManager.setColorLabel(tab, tabId, savedTab.meta.colorLabel);
      }
      if (savedTab.meta.locked) tab.classList.add('locked');
      if (savedTab.meta.pinned) tab.classList.add('pinned');
    }

    // Create terminal wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'terminal-wrapper';
    wrapper.dataset.id = tabId;
    terminalContainer.appendChild(wrapper);

    // Deserialize pane tree
    // Set termIdCounter high enough to avoid collisions
    const maxTermId = extractMaxTermId(savedTab.rootPane);
    splitPane.setTermIdCounter(maxTermId + 1);

    const result = splitPane.deserializePaneTree(savedTab.rootPane);
    if (!result) continue;

    const { node: rootPane, leaves } = result;
    wrapper.appendChild(splitPane.getDomElement(rootPane));

    // Register pane-focus event
    wrapper.addEventListener('pane-focus', (e) => {
      const tabEntry = tabs.get(tabId);
      if (tabEntry && tabEntry.activePaneId !== e.detail.paneId) {
        tabEntry.activePaneId = e.detail.paneId;
        splitPane.focusPane(tabEntry.rootPane, e.detail.paneId);
      }
    });

    // Create and restore scratch pad (if enabled)
    if (isScratchPadEnabled()) {
      scratchPad.createForTab(tabId, wrapper);
      scratchPad.restoreForTab(tabId, savedTab.scratchPad);
    }
    wrapper.addEventListener('scratch-pad-resize', () => {
      const te = tabs.get(tabId);
      if (te) requestAnimationFrame(() => splitPane.refitPaneTree(te.rootPane));
    });

    // Store tab data
    tabs.set(tabId, { tab, wrapper, rootPane, activePaneId: savedTab.activePaneId || (leaves[0] ? leaves[0].leaf.id : null) });

    // Attach drag handles to restored leaves
    for (const { leaf: restoredLeaf } of leaves) {
      paneDrag.attachDragHandle(restoredLeaf);
    }

    // Create PTYs and write buffer for each leaf
    for (const { leaf, cwd, profileId, buffer } of leaves) {
      panesByTerminalId.set(leaf.terminalId, { tabId, paneId: leaf.id });
      await window.terminalAPI.create(leaf.terminalId, profileId, cwd);
      if (buffer) {
        leaf.term.write(buffer);
      }
    }

    // Add tab to group if needed
    if (savedTab.groupId && tabManager.addTabToGroup) {
      tabManager.addTabToGroup(tabId, savedTab.groupId);
    }
  }

  // Switch to active tab
  const targetTabId = session.activeTabId && tabs.has(session.activeTabId)
    ? session.activeTabId
    : [...tabs.keys()][0];
  if (targetTabId) switchTab(targetTabId);

  // Render groups
  if (tabManager.renderGroups) {
    tabManager.renderGroups(tabsContainer);
  }

  return tabs.size > 0;
}

function extractMaxTermId(node) {
  if (!node) return 0;
  if (node.type === 'leaf') {
    const match = node.terminalId && node.terminalId.match(/term-(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  if (node.type === 'branch') {
    return Math.max(...node.children.map(extractMaxTermId));
  }
  return 0;
}

// ── Initialization ──
async function init() {
  // Check encryption unlock before anything else
  await checkEncryptionUnlock();

  await profileMod.loadProfiles();
  await themeEngine.initThemeEngine();

  // Apply saved opacity
  if (window.settingsAPI) {
    const savedSettings = await window.settingsAPI.get('settings');
    if (savedSettings && savedSettings.terminalOpacity != null && savedSettings.terminalOpacity < 1.0) {
      themeEngine.applyOpacity(savedSettings.terminalOpacity);
    } else if (savedSettings && savedSettings.terminalOpacity >= 1.0) {
      themeEngine.applyOpacity(1.0);
    }
  }

  // Apply saved background
  if (window.settingsAPI) {
    const savedBg = await window.settingsAPI.get('background');
    if (savedBg) settingsPanel.applyBackground(savedBg);
  }

  // Auto-pull on startup
  if (window.syncAPI) {
    try {
      const syncConfig = await window.syncAPI.getConfig();
      if (syncConfig && syncConfig.enabled && syncConfig.accessKeyId && syncConfig.secretAccessKey && syncConfig.bucket) {
        const result = await window.syncAPI.pull();
        if (result.data && result.isNewer) {
          const confirmed = confirm('A newer config was found in the cloud. Apply remote settings?');
          if (confirmed) {
            await window.syncAPI.applyPull(result.data);
            await reloadAllSettings();
          }
        }
      }
    } catch (e) {
      // silent auto-pull failure on startup
    }
  }

  // Initialize notifications
  notifications.init({
    getTabForTerminal: (terminalId) => {
      const mapping = panesByTerminalId.get(terminalId);
      return mapping || null;
    },
    getActiveTabId: () => activeTabId,
  });

  // Initialize snippet manager
  snippetsMod.init({
    onPasteToTerminal: (command) => {
      if (!activeTabId) return;
      const tabEntry = tabs.get(activeTabId);
      if (!tabEntry) return;
      const activeLeaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
      if (activeLeaf) window.terminalAPI.write(activeLeaf.terminalId, command);
    },
  });

  // Initialize SSH manager
  sshManager.init({
    onConnect: async (sshCommand, label) => {
      const tabId = await createTab();
      // Write SSH command after a short delay for shell to be ready
      const tabEntry = tabs.get(tabId);
      if (tabEntry) {
        const leaf = splitPane.getFirstLeaf(tabEntry.rootPane);
        if (leaf) {
          setTimeout(() => {
            window.terminalAPI.write(leaf.terminalId, sshCommand);
            // Extract host from label for SSH health
            const hostMatch = label && label.match(/SSH:\s*(.+)/);
            if (hostMatch) {
              sshHealth.registerSshCommand(leaf.terminalId, hostMatch[1], sshCommand);
            }
            if (label) {
              const meta = tabManager.getMeta(tabId);
              if (meta) meta.label = label;
              const titleEl = tabEntry.tab.querySelector('.tab-title');
              if (titleEl) titleEl.textContent = label;
            }
          }, 300);
        }
      }
    },
  });

  // Load settings early so createPaneLeaf picks up user preferences (scrollback, font, etc.)
  await settingsPanel.loadSettings();

  // Initialize settings panel
  settingsPanel.init({
    themeEngine,
    profileMod,
    onSettingsChanged: (newSettings) => {
      notifications.updateSettings(newSettings);
      // Apply terminal options to all existing terminals
      tabs.forEach((tabEntry) => {
        const leaves = splitPane.collectLeaves(tabEntry.rootPane);
        leaves.forEach((leaf) => {
          if (newSettings.scrollback != null) leaf.term.options.scrollback = newSettings.scrollback;
          if (newSettings.fontSize != null) leaf.term.options.fontSize = newSettings.fontSize;
          if (newSettings.fontFamily) leaf.term.options.fontFamily = newSettings.fontFamily;
          if (newSettings.cursorStyle) leaf.term.options.cursorStyle = newSettings.cursorStyle;
          if (newSettings.cursorBlink != null) leaf.term.options.cursorBlink = newSettings.cursorBlink;
        });
      });
      // Refit active tab to apply font size changes
      if (activeTabId) {
        const tabEntry = tabs.get(activeTabId);
        if (tabEntry) splitPane.refitPaneTree(tabEntry.rootPane);
      }
      // Toggle scratch pads for all tabs when setting changes
      if (newSettings.scratchPadEnabled) {
        tabs.forEach((entry, tabId) => {
          if (!scratchPad.getForTab(tabId)) {
            scratchPad.createForTab(tabId, entry.wrapper);
          }
        });
      } else {
        tabs.forEach((_entry, tabId) => {
          scratchPad.removeForTab(tabId);
        });
        // Refit all tabs after removing scratch pads
        tabs.forEach((entry) => {
          requestAnimationFrame(() => splitPane.refitPaneTree(entry.rootPane));
        });
      }
    },
  });

  // Initialize process monitor
  processMonitor.init({
    getTerminalIdForTab: (tabId) => {
      const tabEntry = tabs.get(tabId);
      if (!tabEntry) return null;
      const leaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
      return leaf ? leaf.terminalId : null;
    },
  });

  // Initialize clipboard ring
  clipboardRing.init({
    onPaste: (text) => {
      if (!activeTabId) return;
      const tabEntry = tabs.get(activeTabId);
      if (!tabEntry) return;
      const activeLeaf = splitPane.findLeaf(tabEntry.rootPane, tabEntry.activePaneId);
      if (activeLeaf) activeLeaf.term.paste(text);
    },
  });
  clipboardRing.startClipboardPolling();

  // Initialize job tracker
  jobTracker.init({
    getTerminals: () => [...panesByTerminalId.keys()],
  });

  // Initialize scratch pad
  scratchPad.init({
    onContentChange: () => scheduleSessionSave(),
  });

  // Initialize command history
  commandHistory.init({
    onNavigate: (tabId, terminalId, bufferLine) => {
      if (tabs.has(tabId)) {
        switchTab(tabId);
        const tabEntry = tabs.get(tabId);
        if (tabEntry) {
          const leaf = splitPane.findLeafByTerminalId(tabEntry.rootPane, terminalId);
          if (leaf && bufferLine != null) {
            leaf.term.scrollToLine(bufferLine);
          }
        }
      }
    },
    getTabLabel: (tabId) => {
      const tabEntry = tabs.get(tabId);
      if (!tabEntry) return 'Unknown';
      const meta = tabManager.getMeta(tabId);
      return (meta && meta.label) || tabManager.getDisplayTitle(tabId, 'Terminal');
    },
  });

  // Initialize SSH health monitor
  sshHealth.init({
    getSshConnections: () => sshConnections,
    getTabForTerminal: (terminalId) => panesByTerminalId.get(terminalId) || null,
    getTabEntry: (tabId) => tabs.get(tabId) || null,
    writeToTerminal: (terminalId, data) => window.terminalAPI.write(terminalId, data),
    findLeaf: (tabId, terminalId) => {
      const tabEntry = tabs.get(tabId);
      if (!tabEntry) return null;
      return splitPane.findLeafByTerminalId(tabEntry.rootPane, terminalId);
    },
  });

  // Initialize pane drag-drop
  paneDrag.init({
    getTabs: () => tabs,
    getPaneMap: () => panesByTerminalId,
    switchTab,
    getActiveTabId: () => activeTabId,
    createTabWithPane: async (leaf) => {
      const id = `tab-${++tabCounter}`;
      const tab = createTabElement(id, `Terminal ${tabCounter}`);
      tabsContainer.appendChild(tab);
      tabManager.registerTab(id, tab);

      const wrapper = document.createElement('div');
      wrapper.className = 'terminal-wrapper';
      wrapper.dataset.id = id;
      terminalContainer.appendChild(wrapper);

      // Mount the leaf into this tab
      leaf.wrapper.style.flex = '';
      wrapper.appendChild(leaf.wrapper);

      if (isScratchPadEnabled()) {
        scratchPad.createForTab(id, wrapper);
      }
      wrapper.addEventListener('scratch-pad-resize', () => {
        const te = tabs.get(id);
        if (te) requestAnimationFrame(() => splitPane.refitPaneTree(te.rootPane));
      });

      wrapper.addEventListener('pane-focus', (e) => {
        const tabEntry = tabs.get(id);
        if (tabEntry && tabEntry.activePaneId !== e.detail.paneId) {
          tabEntry.activePaneId = e.detail.paneId;
          splitPane.focusPane(tabEntry.rootPane, e.detail.paneId);
        }
      });

      tabs.set(id, { tab, wrapper, rootPane: leaf, activePaneId: leaf.id });
      panesByTerminalId.set(leaf.terminalId, { tabId: id, paneId: leaf.id });

      switchTab(id);
      requestAnimationFrame(() => splitPane.refitPaneTree(leaf));
      scheduleSessionSave();
      return id;
    },
    closeTabIfEmpty: (tabId) => {
      const tabEntry = tabs.get(tabId);
      if (!tabEntry) return;
      const leaves = splitPane.collectLeaves(tabEntry.rootPane);
      if (leaves.length === 0) {
        scratchPad.removeForTab(tabId);
        tabEntry.tab.remove();
        tabEntry.wrapper.remove();
        tabs.delete(tabId);
        tabManager.unregisterTab(tabId);
        if (activeTabId === tabId) {
          activeTabId = null;
          const remaining = [...tabs.keys()];
          if (remaining.length > 0) switchTab(remaining[remaining.length - 1]);
        }
        updateEmptyState();
        scheduleSessionSave();
      }
    },
    scheduleSessionSave,
    refitTab: (tabId) => {
      const tabEntry = tabs.get(tabId);
      if (tabEntry) requestAnimationFrame(() => splitPane.refitPaneTree(tabEntry.rootPane));
    },
    getZoomState: () => zoomState,
    toggleZoom,
    splitPane,
  });

  // Register command palette actions
  registerPaletteActions();

  // Quake mode events
  if (isQuakeMode) {
    window.quakeAPI.onShow(() => {
      // Refit terminals when quake window is shown
      tabs.forEach((entry) => splitPane.refitPaneTree(entry.rootPane));
    });
  }

  // Session restore or create first terminal
  if (!isQuakeMode) {
    const restored = await restoreSession();
    if (!restored) createTab();
  } else {
    createTab();
  }

  // Listen for before-quit session save request
  if (window.sessionAPI) {
    window.sessionAPI.onSaveRequest(async (windowId) => {
      try {
        const settings = settingsPanel.getSettings();
        if (settings.restoreSession === false) return;
        const state = await collectSessionState();
        window.settingsAPI.set('session', state);
      } catch (e) {
        // silent
      } finally {
        if (windowId !== undefined) window.sessionAPI.confirmSaved(windowId);
      }
    });
  }
}

function registerPaletteActions() {
  const allThemes = themeEngine.getAllThemes();
  const profiles = profileMod.getProfiles ? profileMod.getProfiles() : [];

  commandPalette.registerActions([
    // Tab actions
    { id: 'new-tab', label: 'New Tab', category: 'Tab', shortcut: 'Ctrl+T', handler: () => createTab() },
    { id: 'close-tab', label: 'Close Tab', category: 'Tab', shortcut: 'Ctrl+W', handler: () => { if (activeTabId) closeTab(activeTabId); } },
    { id: 'next-tab', label: 'Next Tab', category: 'Tab', shortcut: 'Ctrl+Tab', handler: () => {
      const ids = [...tabs.keys()];
      if (ids.length < 2) return;
      const idx = ids.indexOf(activeTabId);
      switchTab(ids[(idx + 1) % ids.length]);
    }},
    { id: 'prev-tab', label: 'Previous Tab', category: 'Tab', shortcut: 'Ctrl+Shift+Tab', handler: () => {
      const ids = [...tabs.keys()];
      if (ids.length < 2) return;
      const idx = ids.indexOf(activeTabId);
      switchTab(ids[(idx - 1 + ids.length) % ids.length]);
    }},

    // Pane actions
    { id: 'split-h', label: 'Split Horizontal', category: 'Pane', shortcut: 'Ctrl+Shift+E', handler: () => splitCurrentPane('horizontal') },
    { id: 'split-v', label: 'Split Vertical', category: 'Pane', shortcut: 'Ctrl+Shift+D', handler: () => splitCurrentPane('vertical') },
    { id: 'close-pane', label: 'Close Pane', category: 'Pane', shortcut: 'Ctrl+Shift+W', handler: () => closeFocusedPane() },
    { id: 'nav-left', label: 'Navigate Left', category: 'Pane', shortcut: 'Ctrl+Alt+Left', handler: () => navigatePanes('ArrowLeft') },
    { id: 'nav-right', label: 'Navigate Right', category: 'Pane', shortcut: 'Ctrl+Alt+Right', handler: () => navigatePanes('ArrowRight') },
    { id: 'nav-up', label: 'Navigate Up', category: 'Pane', shortcut: 'Ctrl+Alt+Up', handler: () => navigatePanes('ArrowUp') },
    { id: 'nav-down', label: 'Navigate Down', category: 'Pane', shortcut: 'Ctrl+Alt+Down', handler: () => navigatePanes('ArrowDown') },
    { id: 'zoom-pane', label: 'Zoom/Unzoom Pane', category: 'Pane', shortcut: 'Ctrl+Shift+Z', handler: () => toggleZoom() },

    // Search
    { id: 'search', label: 'Toggle Search', category: 'Search', shortcut: 'Ctrl+Shift+F', handler: () => toggleSearch() },

    // Groups
    { id: 'new-group', label: 'Create New Tab Group', category: 'Group', handler: () => {
      if (activeTabId) {
        const groupId = tabManager.createGroup('New Group', '#7aa2f7');
        tabManager.addTabToGroup(activeTabId, groupId);
        tabManager.renderGroups(tabsContainer);
        scheduleSessionSave();
      }
    }},
    { id: 'ungroup-tab', label: 'Remove Tab from Group', category: 'Group', handler: () => {
      if (activeTabId) {
        tabManager.removeTabFromGroup(activeTabId);
        tabManager.renderGroups(tabsContainer);
        scheduleSessionSave();
      }
    }},

    // Tools
    { id: 'snippets', label: 'Snippet Manager', category: 'Tools', shortcut: 'Ctrl+Shift+S', handler: () => snippetsMod.toggle() },
    { id: 'ssh', label: 'SSH Connections', category: 'Tools', handler: () => sshManager.toggle() },
    { id: 'export', label: 'Export Terminal', category: 'Tools', shortcut: 'Ctrl+Shift+X', handler: () => exportActiveTerminal() },
    { id: 'settings', label: 'Open Settings', category: 'Tools', handler: () => settingsPanel.toggle() },
    { id: 'clipboard-ring', label: 'Clipboard Ring', category: 'Tools', shortcut: 'Ctrl+Alt+V', handler: () => clipboardRing.openPopup() },
    { id: 'job-tracker', label: 'Background Job Tracker', category: 'Tools', shortcut: 'Ctrl+Shift+J', handler: () => jobTracker.toggle() },
    { id: 'toggle-scratch-pad', label: 'Toggle Scratch Pad', category: 'Tools', shortcut: 'Ctrl+Shift+N', handler: () => { if (activeTabId && isScratchPadEnabled()) scratchPad.toggle(activeTabId); } },
    { id: 'command-history', label: 'Command History', category: 'Tools', shortcut: 'Ctrl+Shift+H', handler: () => commandHistory.toggle() },
    { id: 'clear-command-history', label: 'Clear Command History', category: 'Tools', handler: () => commandHistory.clearHistory() },

    // Layouts
    ...tilingLayouts.getLayouts().map((l) => ({
      id: `layout-${l.id}`,
      label: `Layout: ${l.name}`,
      category: 'Layout',
      handler: () => applyLayout(l.id),
    })),

    // Theme actions
    { id: 'theme-editor', label: 'Custom Theme Editor', category: 'Theme', handler: () => themeEngine.openThemeEditor() },
    ...allThemes.map((t) => ({
      id: `theme-${t.id}`,
      label: t.name,
      category: 'Theme',
      handler: () => { themeEngine.applyTheme(t.id); themeEngine.renderThemePicker(); },
    })),

    // Tab jump
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `tab-${i + 1}`,
      label: `Switch to Tab ${i + 1}`,
      category: 'Tab',
      shortcut: `Ctrl+${i + 1}`,
      handler: () => {
        const ids = [...tabs.keys()];
        if (i < ids.length) switchTab(ids[i]);
      },
    })),
  ]);

  // Profile actions
  if (profiles.length > 0) {
    commandPalette.registerActions(
      profiles.map((p) => ({
        id: `profile-${p.id}`,
        label: `New Tab: ${p.name}`,
        category: 'Profile',
        handler: () => createTab(p.id),
      }))
    );
  }
}

init();
