// ── Notifications & Badge ──
// Track terminal activity, show badges on background tabs, system notifications

const terminalActivity = new Map(); // terminalId -> { hasUnread, lastOutputTime, silent }
let getTabForTerminalFn = null;
let getActiveTabIdFn = null;
let notificationsEnabled = true;
let notificationThreshold = 30; // seconds of silence before system notification

// Notification Rules (F10)
let notificationRules = []; // { id, pattern, caseSensitive, systemNotification, label, _regex }

function init(opts) {
  getTabForTerminalFn = opts.getTabForTerminal;
  getActiveTabIdFn = opts.getActiveTabId;

  // Load settings
  if (window.settingsAPI) {
    window.settingsAPI.get('settings').then((settings) => {
      if (settings) {
        if (settings.notificationsEnabled !== undefined) notificationsEnabled = settings.notificationsEnabled;
        if (settings.notificationThreshold !== undefined) notificationThreshold = settings.notificationThreshold;
      }
    });
  }

  // Load notification rules (F10)
  loadRules();
}

function onTerminalOutput(terminalId, data) {
  const now = Date.now();
  const activity = terminalActivity.get(terminalId);

  if (!activity) {
    terminalActivity.set(terminalId, { hasUnread: false, lastOutputTime: now, silent: false });
    return;
  }

  const wasSilent = activity.silent || (now - activity.lastOutputTime > notificationThreshold * 1000);

  // Find which tab this terminal belongs to
  const tabInfo = getTabForTerminalFn ? getTabForTerminalFn(terminalId) : null;
  const activeTabId = getActiveTabIdFn ? getActiveTabIdFn() : null;

  if (tabInfo && tabInfo.tabId !== activeTabId) {
    // Background tab — set badge
    activity.hasUnread = true;
    setBadge(tabInfo.tabId, true);

    // System notification for long-running commands
    if (wasSilent && notificationsEnabled) {
      showSystemNotification(terminalId, tabInfo.tabId);
    }
  }

  activity.lastOutputTime = now;
  activity.silent = false;

  // Check notification rules (F10)
  checkRules(terminalId, data);
}

function onTabSwitch(tabId) {
  // Clear badges for the activated tab
  clearBadge(tabId);
}

function onTerminalCreated(terminalId) {
  terminalActivity.set(terminalId, {
    hasUnread: false,
    lastOutputTime: Date.now(),
    silent: false,
  });
}

function onTerminalDestroyed(terminalId) {
  terminalActivity.delete(terminalId);
}

function setBadge(tabId, show) {
  const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
  if (!tabEl) return;

  let badge = tabEl.querySelector('.tab-badge');
  if (show && !badge) {
    badge = document.createElement('span');
    badge.className = 'tab-badge';
    tabEl.appendChild(badge);
  } else if (!show && badge) {
    badge.remove();
  }
}

function clearBadge(tabId) {
  setBadge(tabId, false);

  // Clear unread state for all terminals in this tab
  terminalActivity.forEach((activity, termId) => {
    const tabInfo = getTabForTerminalFn ? getTabForTerminalFn(termId) : null;
    if (tabInfo && tabInfo.tabId === tabId) {
      activity.hasUnread = false;
    }
  });
}

function showSystemNotification(terminalId, tabId) {
  if (!notificationsEnabled) return;

  const title = 'Terminal Activity';
  const body = 'A background terminal has new output after being idle.';

  // Use Electron Notification via IPC
  if (window.notificationAPI) {
    window.notificationAPI.show(title, body);
  }
}

// Periodically mark terminals as silent if no output
let silenceInterval = setInterval(() => {
  const now = Date.now();
  terminalActivity.forEach((activity) => {
    if (now - activity.lastOutputTime > notificationThreshold * 1000) {
      activity.silent = true;
    }
  });
}, 5000);

function updateSettings(settings) {
  if (settings.notificationsEnabled !== undefined) notificationsEnabled = settings.notificationsEnabled;
  if (settings.notificationThreshold !== undefined) notificationThreshold = settings.notificationThreshold;
}

// ── Notification Rules (F10) ──
async function loadRules() {
  if (!window.notificationRulesAPI) return;
  try {
    const rules = await window.notificationRulesAPI.getAll();
    notificationRules = (rules || []).map((r) => {
      try {
        const flags = r.caseSensitive ? 'g' : 'gi';
        r._regex = new RegExp(r.pattern, flags);
      } catch (e) {
        r._regex = null;
      }
      return r;
    });
  } catch (e) {
    notificationRules = [];
  }
}

function checkRules(terminalId, data) {
  if (!notificationRules.length) return;
  for (const rule of notificationRules) {
    if (!rule._regex || rule.systemNotification === false) continue;
    rule._regex.lastIndex = 0;
    if (rule._regex.test(data)) {
      const label = rule.label || rule.pattern;
      if (window.notificationAPI) {
        window.notificationAPI.show('Rule Match', `"${label}" matched in terminal ${terminalId}`);
      }
    }
  }
}

module.exports = {
  init,
  onTerminalOutput,
  onTabSwitch,
  onTerminalCreated,
  onTerminalDestroyed,
  clearBadge,
  updateSettings,
  loadRules,
  checkRules,
};
