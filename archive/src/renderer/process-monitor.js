// ── Process Monitor (F4) ──
// Shows CPU/RAM popup on tab hover

const statsCache = new Map(); // terminalId -> { vmRssKb, cpuPercent, lastUtime, lastStime, lastTimestamp, pid, processName }
let popupEl = null;
let showTimer = null;
let hideTimer = null;
let currentPopupTerminalId = null;
let currentAnchorEl = null; // tracked for repositioning
let hoveredTab = null; // the .tab element the mouse is currently over

function onProcessStats(terminalId, stats) {
  const prev = statsCache.get(terminalId);
  const now = Date.now();
  let cpuPercent = 0;

  if (prev && prev.lastTimestamp) {
    const dtMs = now - prev.lastTimestamp;
    if (dtMs > 0) {
      const ticksPerSec = 100; // standard jiffies
      const dUtime = stats.utime - (prev.lastUtime || 0);
      const dStime = stats.stime - (prev.lastStime || 0);
      const totalTicks = dUtime + dStime;
      cpuPercent = Math.min(100, (totalTicks / ticksPerSec) / (dtMs / 1000) * 100);
    }
  }

  statsCache.set(terminalId, {
    vmRssKb: stats.vmRssKb,
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    lastUtime: stats.utime,
    lastStime: stats.stime,
    lastTimestamp: now,
    pid: stats.pid,
    processName: stats.processName,
  });

  // Update popup if currently showing this terminal
  if (currentPopupTerminalId === terminalId && popupEl && popupEl.style.display !== 'none') {
    renderPopupContent(terminalId);
  }
}

function ensurePopupEl() {
  if (!popupEl) {
    popupEl = document.createElement('div');
    popupEl.className = 'process-monitor-popup';
    document.body.appendChild(popupEl);
    // Stable listeners — added once, never leak
    popupEl.addEventListener('mouseenter', () => clearHideTimer());
    popupEl.addEventListener('mouseleave', () => scheduleHide());
  }
}

function positionPopup(anchorEl) {
  if (!popupEl) return;
  const rect = anchorEl.getBoundingClientRect();
  popupEl.style.top = `${rect.bottom + 4}px`;
  popupEl.style.left = `${rect.left}px`;
}

function showPopup(terminalId, anchorEl) {
  ensurePopupEl();

  currentPopupTerminalId = terminalId;
  currentAnchorEl = anchorEl;
  renderPopupContent(terminalId);

  popupEl.style.display = 'block';
  positionPopup(anchorEl);
}

function renderPopupContent(terminalId) {
  const data = statsCache.get(terminalId);
  if (!data || !popupEl) return;

  const memMb = (data.vmRssKb / 1024).toFixed(1);
  popupEl.innerHTML = `
    <div class="pm-header">${data.processName || 'Process'}</div>
    <div class="pm-stat-row">
      <span class="pm-label">PID</span><span class="pm-value">${data.pid || '-'}</span>
    </div>
    <div class="pm-stat-row">
      <span class="pm-label">CPU</span><span class="pm-value">${data.cpuPercent}%</span>
    </div>
    <div class="pm-stat-row">
      <span class="pm-label">MEM</span><span class="pm-value">${memMb} MB</span>
    </div>
  `;
}

function hidePopup() {
  if (popupEl) {
    popupEl.style.display = 'none';
  }
  currentPopupTerminalId = null;
  currentAnchorEl = null;
}

function clearShowTimer() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
}

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function clearAllTimers() {
  clearShowTimer();
  clearHideTimer();
}

function scheduleShow(terminalId, anchorEl) {
  clearAllTimers();
  showTimer = setTimeout(() => {
    showTimer = null;
    showPopup(terminalId, anchorEl);
  }, 500);
}

function scheduleHide() {
  clearShowTimer();
  clearHideTimer();
  hideTimer = setTimeout(() => {
    hideTimer = null;
    hidePopup();
  }, 300);
}

function removeTerminal(terminalId) {
  statsCache.delete(terminalId);
  if (currentPopupTerminalId === terminalId) {
    clearAllTimers();
    hidePopup();
  }
}

function init({ getTerminalIdForTab }) {
  const tabsContainer = document.getElementById('tabs');
  if (!tabsContainer) return;

  // Use mouseover/mouseout (bubble) with hoveredTab tracking
  // to avoid the capture-phase child-element re-fire problem
  tabsContainer.addEventListener('mouseover', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab || tab === hoveredTab) return; // still inside the same tab
    hoveredTab = tab;
    clearHideTimer();
    const tabId = tab.dataset.id;
    const terminalId = getTerminalIdForTab(tabId);
    if (terminalId && statsCache.has(terminalId)) {
      scheduleShow(terminalId, tab);
    } else {
      // No stats for this tab — cancel any pending show and hide current popup
      clearShowTimer();
      if (currentPopupTerminalId) scheduleHide();
    }
  });

  tabsContainer.addEventListener('mouseout', (e) => {
    // Only act when the mouse actually leaves the tab (not entering a child)
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const related = e.relatedTarget;
    if (related && tab.contains(related)) return; // moved to child — ignore
    if (hoveredTab === tab) hoveredTab = null;
    scheduleHide();
  });

  // Reposition popup on window resize / scroll
  window.addEventListener('resize', () => {
    if (currentAnchorEl && popupEl && popupEl.style.display !== 'none') {
      positionPopup(currentAnchorEl);
    }
  });
}

module.exports = {
  init,
  onProcessStats,
  showPopup,
  hidePopup,
  removeTerminal,
  statsCache,
};
