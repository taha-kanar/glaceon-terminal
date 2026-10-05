// ── Command History Timeline ──
// Sidebar panel showing a scrollable timeline of commands across all terminals

let history = [];
let isOpen = false;
let panelEl = null;
let onNavigateFn = null;
let getTabLabelFn = null;
let saveTimer = null;
const MAX_ENTRIES = 500;

function init(opts) {
  onNavigateFn = opts.onNavigate;
  getTabLabelFn = opts.getTabLabel;
  panelEl = document.getElementById('command-history-panel');

  // Load persisted history
  if (window.commandHistoryAPI) {
    window.commandHistoryAPI.getAll().then((saved) => {
      if (Array.isArray(saved)) history = saved;
    }).catch(() => {});
  }
}

function recordCommandStart(terminalId, tabId, name, startTime, bufferLine) {
  const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tabLabel = getTabLabelFn ? getTabLabelFn(tabId) : 'Terminal';

  const entry = {
    id,
    command: name,
    terminalId,
    tabId,
    tabLabel,
    startTime,
    durationMs: null,
    bufferLine,
    status: 'running',
  };

  history.unshift(entry);
  if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);

  if (isOpen) renderEntries();
  scheduleSave();
}

function recordCommandDone(terminalId, name, durationMs) {
  // Find the most recent running entry for this terminal
  const entry = history.find((e) => e.terminalId === terminalId && e.status === 'running');
  if (entry) {
    entry.status = 'done';
    entry.durationMs = durationMs;
    if (isOpen) renderEntries();
    scheduleSave();
  }
}

function recordTerminalExit(terminalId, exitCode) {
  // Mark any running entries for this terminal as done
  for (const entry of history) {
    if (entry.terminalId === terminalId && entry.status === 'running') {
      entry.status = 'done';
      if (!entry.durationMs) {
        entry.durationMs = Date.now() - entry.startTime;
      }
    }
  }
  if (isOpen) renderEntries();
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (window.commandHistoryAPI) {
      window.commandHistoryAPI.save(history);
    }
  }, 5000);
}

function open() {
  if (isOpen) return;
  isOpen = true;
  if (!panelEl) panelEl = document.getElementById('command-history-panel');
  if (!panelEl) return;
  render();
  panelEl.classList.add('open');
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  if (panelEl) {
    panelEl.classList.remove('open');
  }
}

function toggle() {
  if (isOpen) close();
  else open();
}

function clearHistory() {
  history = [];
  if (window.commandHistoryAPI) window.commandHistoryAPI.clear();
  if (isOpen) renderEntries();
}

function render() {
  if (!panelEl) return;

  panelEl.innerHTML = `
    <div class="ch-header">
      <h3 class="ch-title">Command History</h3>
      <div class="ch-actions">
        <button class="ch-clear-btn" title="Clear History">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <button class="ch-close-btn" title="Close">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/>
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="ch-search-bar">
      <input type="text" class="ch-search-input" placeholder="Filter commands..." spellcheck="false" />
    </div>
    <div class="ch-entries"></div>
  `;

  panelEl.querySelector('.ch-close-btn').addEventListener('click', close);
  panelEl.querySelector('.ch-clear-btn').addEventListener('click', clearHistory);

  const searchInput = panelEl.querySelector('.ch-search-input');
  searchInput.addEventListener('input', () => {
    renderEntries(searchInput.value.toLowerCase());
  });

  renderEntries();
}

function renderEntries(filter) {
  const container = panelEl?.querySelector('.ch-entries');
  if (!container) return;

  const filtered = filter
    ? history.filter((e) => e.command.toLowerCase().includes(filter) || e.tabLabel.toLowerCase().includes(filter))
    : history;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="ch-empty">No commands recorded yet.</div>';
    return;
  }

  // Preserve scroll position across re-renders
  const scrollTop = container.scrollTop;

  container.innerHTML = filtered.map((entry) => {
    const time = new Date(entry.startTime);
    const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;
    const durationStr = entry.durationMs != null ? formatDuration(entry.durationMs) : '';
    const statusClass = entry.status === 'running' ? 'ch-running' : 'ch-done';

    return `
      <div class="ch-entry ${statusClass}" data-id="${entry.id}">
        <div class="ch-entry-header">
          <span class="ch-command">${escapeHtml(entry.command)}</span>
          ${entry.status === 'running' ? '<span class="ch-status-dot"></span>' : ''}
        </div>
        <div class="ch-entry-meta">
          <span class="ch-tab-label">${escapeHtml(entry.tabLabel)}</span>
          <span class="ch-time">${timeStr}</span>
          ${durationStr ? `<span class="ch-duration">${durationStr}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Restore scroll position
  container.scrollTop = scrollTop;

  // Click handlers
  container.querySelectorAll('.ch-entry').forEach((el) => {
    el.addEventListener('click', () => {
      const entry = history.find((e) => e.id === el.dataset.id);
      if (entry && onNavigateFn) {
        onNavigateFn(entry.tabId, entry.terminalId, entry.bufferLine);
      }
    });
  });
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  init,
  recordCommandStart,
  recordCommandDone,
  recordTerminalExit,
  open,
  close,
  toggle,
  clearHistory,
};
