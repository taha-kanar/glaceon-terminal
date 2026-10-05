// ── SSH Connection Health Monitor ──
// Ping/latency indicator on SSH tabs, auto-reconnect banner on disconnect

const sshHealth = new Map(); // terminalId -> { host, latencyMs, status, command, reconnectAttempts, intervalId }

let callbacks = {};

function init(opts) {
  callbacks = opts;
}

function registerSshCommand(terminalId, host, command) {
  // Don't replace existing entry with better info
  const existing = sshHealth.get(terminalId);
  if (existing) {
    if (command && !existing.command) existing.command = command;
    return;
  }

  const entry = {
    host,
    latencyMs: null,
    status: 'connected', // 'connected' | 'degraded' | 'disconnected'
    command: command || null,
    reconnectAttempts: 0,
    intervalId: null,
  };

  sshHealth.set(terminalId, entry);

  // Start polling latency
  checkLatency(terminalId, entry);
  entry.intervalId = setInterval(() => checkLatency(terminalId, entry), 10000);
}

function unregisterSsh(terminalId) {
  const entry = sshHealth.get(terminalId);
  if (!entry) return;
  if (entry.intervalId) clearInterval(entry.intervalId);
  sshHealth.delete(terminalId);

  // Remove health dot
  removeHealthDot(terminalId);
  // Remove reconnect banner
  removeBanner(terminalId);
}

async function checkLatency(terminalId, entry) {
  if (!entry || !sshHealth.has(terminalId)) return;

  try {
    const latency = await window.sshHealthAPI.checkLatency(entry.host);

    if (!sshHealth.has(terminalId)) return; // may have been removed during await

    if (latency != null) {
      entry.latencyMs = latency;
      entry.status = latency <= 100 ? 'connected' : (latency <= 300 ? 'degraded' : 'disconnected');
      entry.reconnectAttempts = 0;
      updateHealthDot(terminalId, entry);
      removeBanner(terminalId);
    } else {
      entry.latencyMs = null;
      entry.status = 'disconnected';
      updateHealthDot(terminalId, entry);
      showReconnectBanner(terminalId, entry);
    }
  } catch (e) {
    entry.status = 'disconnected';
    updateHealthDot(terminalId, entry);
  }
}

function updateHealthDot(terminalId, entry) {
  const mapping = callbacks.getTabForTerminal?.(terminalId);
  if (!mapping) return;
  const tabEntry = callbacks.getTabEntry?.(mapping.tabId);
  if (!tabEntry) return;

  const badge = tabEntry.tab.querySelector('.ssh-status-badge');
  if (!badge) return;

  // Add or update health dot
  let dot = badge.querySelector('.ssh-health-dot');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'ssh-health-dot';
    badge.insertBefore(dot, badge.firstChild);
  }

  dot.classList.remove('health-good', 'health-warn', 'health-bad');
  if (entry.status === 'disconnected') {
    dot.classList.add('health-bad');
    dot.title = 'Unreachable';
  } else if (entry.latencyMs != null && entry.latencyMs <= 100) {
    dot.classList.add('health-good');
    dot.title = `${Math.round(entry.latencyMs)}ms`;
  } else if (entry.latencyMs != null && entry.latencyMs <= 300) {
    dot.classList.add('health-warn');
    dot.title = `${Math.round(entry.latencyMs)}ms`;
  } else {
    dot.classList.add('health-warn');
    dot.title = entry.latencyMs != null ? `${Math.round(entry.latencyMs)}ms` : 'Checking...';
  }
}

function removeHealthDot(terminalId) {
  const mapping = callbacks.getTabForTerminal?.(terminalId);
  if (!mapping) return;
  const tabEntry = callbacks.getTabEntry?.(mapping.tabId);
  if (!tabEntry) return;
  const badge = tabEntry.tab.querySelector('.ssh-status-badge');
  if (badge) {
    const dot = badge.querySelector('.ssh-health-dot');
    if (dot) dot.remove();
  }
}

function showReconnectBanner(terminalId, entry) {
  if (!entry.command) return; // Can't reconnect without the original command

  const mapping = callbacks.getTabForTerminal?.(terminalId);
  if (!mapping) return;

  const leaf = callbacks.findLeaf?.(mapping.tabId, terminalId);
  if (!leaf) return;

  // Don't duplicate banner
  if (leaf.wrapper.querySelector('.ssh-reconnect-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'ssh-reconnect-banner';
  banner.innerHTML = `
    <span class="ssh-reconnect-text">SSH connection to <strong>${escapeHtml(entry.host)}</strong> appears lost</span>
    <button class="ssh-reconnect-btn">Reconnect</button>
    <button class="ssh-reconnect-dismiss">&times;</button>
  `;

  banner.querySelector('.ssh-reconnect-btn').addEventListener('click', () => {
    entry.reconnectAttempts++;
    callbacks.writeToTerminal?.(terminalId, entry.command.trimEnd() + '\r');
    banner.remove();
  });

  banner.querySelector('.ssh-reconnect-dismiss').addEventListener('click', () => {
    banner.remove();
  });

  leaf.wrapper.appendChild(banner);
}

function removeBanner(terminalId) {
  const mapping = callbacks.getTabForTerminal?.(terminalId);
  if (!mapping) return;
  const leaf = callbacks.findLeaf?.(mapping.tabId, terminalId);
  if (!leaf) return;
  const banner = leaf.wrapper.querySelector('.ssh-reconnect-banner');
  if (banner) banner.remove();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  init,
  registerSshCommand,
  unregisterSsh,
};
