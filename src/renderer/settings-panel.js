// ── Settings Panel ──
// Sidebar + content layout for all app settings

let isOpen = false;
let panelEl = null;
let currentSection = 'general';
let settings = {};
let keybindings = {};
let background = { type: 'none', color: '#1a1b26', imagePath: '', imageData: '', imageScale: 'cover', imageOpacity: 1.0 };
let themeEngineMod = null;
let profileMod = null;
let onSettingsChangedFn = null;
let cloudSyncConfig = {
  enabled: false, provider: 'aws-s3', accessKeyId: '', secretAccessKey: '', bucket: '', region: 'us-east-1', endpoint: '',
  syncKey: 'glaceon-terminal/config.json',
  pgHost: '', pgPort: 5432, pgDatabase: '', pgUser: '', pgPassword: '', pgTable: 'cloud_sync_config', pgSsl: false,
};
let autoSyncTimer = null;
let encryptionStatus = { isEnabled: false, isUnlocked: false, keySource: 'custom' };

const DEFAULT_SETTINGS = {
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: 14,
  cursorStyle: 'bar',
  cursorBlink: true,
  scrollback: 10000,
  defaultShell: '',
  terminalOpacity: 1.0,
  defaultEditor: 'code',
  notificationsEnabled: true,
  notificationThreshold: 30,
  restoreSession: true,
  loggingEnabled: false,
  logDirectory: '',
};

function init(opts) {
  themeEngineMod = opts.themeEngine;
  profileMod = opts.profileMod;
  onSettingsChangedFn = opts.onSettingsChanged;
}

async function loadSettings() {
  if (window.settingsAPI) {
    const saved = await window.settingsAPI.get('settings');
    settings = { ...DEFAULT_SETTINGS, ...saved };
    keybindings = (await window.settingsAPI.get('keybindings')) || {};
    const savedBg = await window.settingsAPI.get('background');
    if (savedBg) background = { ...background, ...savedBg };
  } else {
    settings = { ...DEFAULT_SETTINGS };
    keybindings = {};
  }
  if (window.syncAPI) {
    const syncCfg = await window.syncAPI.getConfig();
    if (syncCfg) cloudSyncConfig = { ...cloudSyncConfig, ...syncCfg };
    const lastSynced = await window.syncAPI.getLastSynced();
    cloudSyncConfig._lastSynced = lastSynced || '';
  }
  if (window.encryptionAPI) {
    encryptionStatus = await window.encryptionAPI.getStatus();
  }
}

function saveSettings() {
  if (window.settingsAPI) {
    window.settingsAPI.set('settings', settings);
  }
  if (onSettingsChangedFn) onSettingsChangedFn(settings);
}

function saveKeybindings() {
  if (window.settingsAPI) {
    window.settingsAPI.set('keybindings', keybindings);
  }
}

async function open() {
  if (isOpen) return;
  isOpen = true;
  await loadSettings();
  render();
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  panelEl = document.getElementById('settings-panel');
  if (panelEl) {
    panelEl.classList.remove('open');
    panelEl.innerHTML = '';
  }
}

function toggle() {
  if (isOpen) close();
  else open();
}

function render() {
  panelEl = document.getElementById('settings-panel');
  if (!panelEl) return;

  panelEl.innerHTML = `
    <div class="modal-backdrop" data-close="true"></div>
    <div class="modal-content settings-content">
      <div class="modal-header">
        <h3>Settings</h3>
        <button class="modal-close" data-close="true">&times;</button>
      </div>
      <div class="settings-layout">
        <div class="settings-sidebar">
          <button class="settings-nav-btn ${currentSection === 'general' ? 'active' : ''}" data-section="general">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            General
          </button>
          <button class="settings-nav-btn ${currentSection === 'appearance' ? 'active' : ''}" data-section="appearance">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
            </svg>
            Appearance
          </button>
          <button class="settings-nav-btn ${currentSection === 'shortcuts' ? 'active' : ''}" data-section="shortcuts">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <line x1="6" y1="8" x2="6" y2="8"></line>
              <line x1="10" y1="8" x2="10" y2="8"></line>
              <line x1="14" y1="8" x2="14" y2="8"></line>
              <line x1="18" y1="8" x2="18" y2="8"></line>
              <line x1="6" y1="16" x2="18" y2="16"></line>
            </svg>
            Shortcuts
          </button>
          <button class="settings-nav-btn ${currentSection === 'notifications' ? 'active' : ''}" data-section="notifications">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            Notifications
          </button>
          <button class="settings-nav-btn ${currentSection === 'cloudsync' ? 'active' : ''}" data-section="cloudsync">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            </svg>
            Cloud Sync
          </button>
          <button class="settings-nav-btn ${currentSection === 'security' ? 'active' : ''}" data-section="security">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Security
          </button>
        </div>
        <div class="settings-body">
          ${renderSection()}
        </div>
      </div>
    </div>
  `;

  panelEl.classList.add('open');

  // Close handlers
  panelEl.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  // Section nav
  panelEl.querySelectorAll('.settings-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSection = btn.dataset.section;
      render();
    });
  });

  // Attach section-specific events
  attachSectionEvents();
}

function renderSection() {
  switch (currentSection) {
    case 'general': return renderGeneral();
    case 'appearance': return renderAppearance();
    case 'shortcuts': return renderShortcuts();
    case 'notifications': return renderNotifications();
    case 'cloudsync': return renderCloudSync();
    case 'security': return renderSecurity();
    default: return '';
  }
}

function renderGeneral() {
  return `
    <h4 class="settings-section-title">General</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Font Family</span>
          <small>Terminal font family</small>
        </div>
        <input type="text" class="setting-input" id="set-fontFamily" value="${escapeHtml(settings.fontFamily)}" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Font Size</span>
          <small>Terminal font size (8-32)</small>
        </div>
        <input type="number" class="setting-input setting-input-sm" id="set-fontSize" value="${settings.fontSize}" min="8" max="32" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Cursor Style</span>
          <small>Terminal cursor appearance</small>
        </div>
        <select class="setting-select" id="set-cursorStyle">
          <option value="bar" ${settings.cursorStyle === 'bar' ? 'selected' : ''}>Bar</option>
          <option value="block" ${settings.cursorStyle === 'block' ? 'selected' : ''}>Block</option>
          <option value="underline" ${settings.cursorStyle === 'underline' ? 'selected' : ''}>Underline</option>
        </select>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Cursor Blink</span>
          <small>Animate the cursor</small>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="set-cursorBlink" ${settings.cursorBlink ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Scrollback</span>
          <small>Lines of history (100-100000)</small>
        </div>
        <input type="number" class="setting-input setting-input-sm" id="set-scrollback" value="${settings.scrollback}" min="100" max="100000" step="100" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Default Shell</span>
          <small>Leave empty for system default</small>
        </div>
        <input type="text" class="setting-input" id="set-defaultShell" value="${escapeHtml(settings.defaultShell)}" placeholder="e.g. /bin/zsh" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Default Editor</span>
          <small>For opening files from terminal</small>
        </div>
        <select class="setting-select" id="set-defaultEditor">
          <option value="code" ${settings.defaultEditor === 'code' ? 'selected' : ''}>VS Code</option>
          <option value="vim" ${settings.defaultEditor === 'vim' ? 'selected' : ''}>Vim</option>
          <option value="nano" ${settings.defaultEditor === 'nano' ? 'selected' : ''}>Nano</option>
          <option value="emacs" ${settings.defaultEditor === 'emacs' ? 'selected' : ''}>Emacs</option>
          <option value="subl" ${settings.defaultEditor === 'subl' ? 'selected' : ''}>Sublime Text</option>
        </select>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Restore Previous Session</span>
          <small>Reopen tabs, panes, and layout on startup</small>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="set-restoreSession" ${settings.restoreSession !== false ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    <h4 class="settings-section-title">Terminal Logging</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Enable Terminal Logging</span>
          <small>Save raw terminal output to log files</small>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="set-loggingEnabled" ${settings.loggingEnabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Log Directory</span>
          <small>Leave empty for ~/.glaceon-terminal/logs</small>
        </div>
        <input type="text" class="setting-input" id="set-logDirectory" value="${escapeHtml(settings.logDirectory || '')}" placeholder="~/.glaceon-terminal/logs" />
      </div>
    </div>
  `;
}

function renderAppearance() {
  const themes = themeEngineMod ? themeEngineMod.getAllThemes() : [];
  const currentId = themeEngineMod ? themeEngineMod.getCurrentThemeId() : '';

  return `
    <h4 class="settings-section-title">Appearance</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Theme</span>
          <small>Choose a color theme</small>
        </div>
      </div>
      <div class="theme-cards">
        ${themes.map((t) => `
          <div class="theme-card ${t.id === currentId ? 'active' : ''}" data-theme-id="${t.id}">
            <div class="theme-card-preview">
              <span class="theme-card-dot" style="background: ${t.colors.accent}"></span>
              <span class="theme-card-dot" style="background: ${t.colors.terminal.red}"></span>
              <span class="theme-card-dot" style="background: ${t.colors.terminal.green}"></span>
              <span class="theme-card-dot" style="background: ${t.colors.terminal.yellow}"></span>
            </div>
            <span class="theme-card-name">${t.name}</span>
          </div>
        `).join('')}
      </div>
      <div class="setting-item" style="margin-top: 16px">
        <div class="setting-label">
          <span>Window Opacity</span>
          <small id="opacity-percent-label">${Math.round((settings.terminalOpacity || 1.0) * 100)}%</small>
        </div>
        <input type="range" class="setting-range" id="set-terminalOpacity" min="0.1" max="1" step="0.01" value="${settings.terminalOpacity || 1.0}" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Full Opacity</span>
          <small>Disable transparency completely</small>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="set-fullOpacity" ${(settings.terminalOpacity || 1.0) >= 1.0 ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <h4 class="settings-section-title" style="margin-top: 24px">Background</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Background Type</span>
          <small>Behind the glass shell</small>
        </div>
        <select class="setting-select" id="set-bgType">
          <option value="none" ${background.type === 'none' ? 'selected' : ''}>None (Transparent)</option>
          <option value="color" ${background.type === 'color' ? 'selected' : ''}>Solid Color</option>
          <option value="image" ${background.type === 'image' ? 'selected' : ''}>Image</option>
        </select>
      </div>
      <div id="bg-color-group" style="display: ${background.type === 'color' ? 'block' : 'none'}">
        <div class="setting-item">
          <div class="setting-label">
            <span>Background Color</span>
            <small>Solid color behind the glass</small>
          </div>
          <input type="color" class="setting-input setting-input-sm" id="set-bgColor" value="${background.color}" style="width: 48px; height: 30px; padding: 2px; cursor: pointer" />
        </div>
      </div>
      <div id="bg-image-group" style="display: ${background.type === 'image' ? 'block' : 'none'}">
        <div class="setting-item">
          <div class="setting-label">
            <span>Image</span>
            <small id="bg-image-path">${background.imagePath ? background.imagePath.split('/').pop() : 'No image selected'}</small>
          </div>
          <button class="setting-btn" id="btn-bgImage" style="padding: 4px 12px; border: 1px solid var(--glass-border-strong); background: var(--glass-tab); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 12px">Choose</button>
        </div>
        <div class="setting-item">
          <div class="setting-label">
            <span>Scale</span>
            <small>How the image fills the window</small>
          </div>
          <select class="setting-select" id="set-bgScale">
            <option value="cover" ${background.imageScale === 'cover' ? 'selected' : ''}>Cover</option>
            <option value="contain" ${background.imageScale === 'contain' ? 'selected' : ''}>Contain</option>
            <option value="fill" ${background.imageScale === 'fill' ? 'selected' : ''}>Fill</option>
          </select>
        </div>
        <div class="setting-item">
          <div class="setting-label">
            <span>Image Opacity</span>
            <small id="bg-opacity-label">${Math.round((background.imageOpacity || 1.0) * 100)}%</small>
          </div>
          <input type="range" class="setting-range" id="set-bgOpacity" min="0.05" max="1" step="0.01" value="${background.imageOpacity || 1.0}" />
        </div>
      </div>
    </div>
  `;
}

function renderShortcuts() {
  const shortcuts = [
    { id: 'newTab', label: 'New Tab', default: 'Ctrl+T' },
    { id: 'closeTab', label: 'Close Tab', default: 'Ctrl+W' },
    { id: 'nextTab', label: 'Next Tab', default: 'Ctrl+Tab' },
    { id: 'prevTab', label: 'Previous Tab', default: 'Ctrl+Shift+Tab' },
    { id: 'search', label: 'Search', default: 'Ctrl+Shift+F' },
    { id: 'splitVertical', label: 'Split Vertical', default: 'Ctrl+Shift+D' },
    { id: 'splitHorizontal', label: 'Split Horizontal', default: 'Ctrl+Shift+E' },
    { id: 'closePane', label: 'Close Pane', default: 'Ctrl+Shift+W' },
    { id: 'commandPalette', label: 'Command Palette', default: 'Ctrl+Shift+P' },
    { id: 'snippets', label: 'Snippets', default: 'Ctrl+Shift+S' },
    { id: 'exportTerminal', label: 'Export Terminal', default: 'Ctrl+Shift+X' },
  ];

  return `
    <h4 class="settings-section-title">Keyboard Shortcuts</h4>
    <div class="settings-group">
      <div class="shortcuts-table">
        ${shortcuts.map((s) => `
          <div class="shortcut-row">
            <span class="shortcut-label">${s.label}</span>
            <span class="shortcut-key">${keybindings[s.id] || s.default}</span>
          </div>
        `).join('')}
      </div>
      <small class="form-hint" style="margin-top: 8px; display: block">Shortcut rebinding is display-only in this version.</small>
    </div>
  `;
}

function renderNotifications() {
  return `
    <h4 class="settings-section-title">Notifications</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Enable Notifications</span>
          <small>Show system notifications for background terminals</small>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="set-notificationsEnabled" ${settings.notificationsEnabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Idle Threshold</span>
          <small>Seconds of silence before notifying (5-300)</small>
        </div>
        <input type="number" class="setting-input setting-input-sm" id="set-notificationThreshold" value="${settings.notificationThreshold}" min="5" max="300" />
      </div>
    </div>
    <h4 class="settings-section-title">Notification Rules</h4>
    <div class="settings-group">
      <small class="form-hint" style="display:block;margin-bottom:8px">Trigger system notifications when terminal output matches a regex pattern.</small>
      <div id="notification-rules-list"></div>
      <button class="btn-action" id="btn-add-notification-rule" style="margin-top:8px">+ Add Rule</button>
    </div>
  `;
}

let notificationRulesCache = [];

async function loadNotificationRules() {
  if (!window.notificationRulesAPI) return;
  notificationRulesCache = await window.notificationRulesAPI.getAll() || [];
}

function renderNotificationRules() {
  const list = panelEl ? panelEl.querySelector('#notification-rules-list') : null;
  if (!list) return;

  if (notificationRulesCache.length === 0) {
    list.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:8px 0">No rules defined.</div>';
    return;
  }

  list.innerHTML = notificationRulesCache.map((r) => `
    <div class="nr-rule-item" data-rule-id="${r.id}">
      <div class="nr-rule-info">
        <span class="nr-rule-pattern">${escapeHtml(r.pattern)}</span>
        ${r.label ? `<span class="nr-rule-label">${escapeHtml(r.label)}</span>` : ''}
        ${r.caseSensitive ? '<span class="nr-badge">Aa</span>' : ''}
      </div>
      <div class="nr-rule-actions">
        <button class="nr-btn-edit" data-rule-id="${r.id}" title="Edit">&#9998;</button>
        <button class="nr-btn-delete" data-rule-id="${r.id}" title="Delete">&times;</button>
      </div>
    </div>
  `).join('');

  // Bind events
  list.querySelectorAll('.nr-btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await window.notificationRulesAPI.delete(btn.dataset.ruleId);
      await loadNotificationRules();
      renderNotificationRules();
      // Reload rules in notifications module
      const notifMod = require('@renderer/notifications');
      notifMod.loadRules();
    });
  });

  list.querySelectorAll('.nr-btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rule = notificationRulesCache.find((r) => r.id === btn.dataset.ruleId);
      if (rule) showRuleEditor(rule);
    });
  });
}

function showRuleEditor(existingRule) {
  const list = panelEl ? panelEl.querySelector('#notification-rules-list') : null;
  if (!list) return;

  const rule = existingRule || { id: `rule-${Date.now()}`, pattern: '', caseSensitive: false, systemNotification: true, label: '' };
  const isNew = !existingRule;

  // Replace list with inline editor
  list.innerHTML = `
    <div class="nr-editor">
      <div class="setting-item">
        <div class="setting-label"><span>Regex Pattern</span></div>
        <input type="text" class="setting-input" id="nr-pattern" value="${escapeHtml(rule.pattern)}" placeholder="e.g. error|fail" />
      </div>
      <div class="setting-item">
        <div class="setting-label"><span>Label</span></div>
        <input type="text" class="setting-input" id="nr-label" value="${escapeHtml(rule.label || '')}" placeholder="Optional description" />
      </div>
      <div class="setting-item">
        <div class="setting-label"><span>Case Sensitive</span></div>
        <label class="setting-toggle">
          <input type="checkbox" id="nr-caseSensitive" ${rule.caseSensitive ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-action" id="nr-save">${isNew ? 'Add' : 'Save'}</button>
        <button class="btn-action" id="nr-cancel" style="background:var(--glass-border)">Cancel</button>
      </div>
    </div>
  `;

  panelEl.querySelector('#nr-save').addEventListener('click', async () => {
    const pattern = panelEl.querySelector('#nr-pattern').value.trim();
    if (!pattern) return;
    rule.pattern = pattern;
    rule.label = panelEl.querySelector('#nr-label').value.trim();
    rule.caseSensitive = panelEl.querySelector('#nr-caseSensitive').checked;
    rule.systemNotification = true;
    await window.notificationRulesAPI.save(rule);
    await loadNotificationRules();
    renderNotificationRules();
    const notifMod = require('@renderer/notifications');
    notifMod.loadRules();
  });

  panelEl.querySelector('#nr-cancel').addEventListener('click', () => {
    renderNotificationRules();
  });
}

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-south-1',
  'sa-east-1', 'ca-central-1', 'me-south-1',
];

function renderCloudSync() {
  const lastSynced = cloudSyncConfig._lastSynced || '';
  const provider = cloudSyncConfig.provider || 'aws-s3';
  const isS3 = provider === 'aws-s3' || provider === 'minio';
  const isPg = provider === 'postgresql';

  return `
    <h4 class="settings-section-title">Cloud Sync</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Enable Cloud Sync</span>
          <small>Sync settings across devices</small>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="set-syncEnabled" ${cloudSyncConfig.enabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Provider</span>
          <small>Cloud storage backend</small>
        </div>
        <select class="setting-select" id="set-syncProvider">
          <option value="aws-s3" ${provider === 'aws-s3' ? 'selected' : ''}>AWS S3</option>
          <option value="minio" ${provider === 'minio' ? 'selected' : ''}>MinIO</option>
          <option value="postgresql" ${provider === 'postgresql' ? 'selected' : ''}>PostgreSQL</option>
        </select>
      </div>
    </div>

    ${isS3 ? renderS3Fields(provider) : ''}
    ${isPg ? renderPostgreSQLFields() : ''}

    <h4 class="settings-section-title" style="margin-top: 24px">Sync Key</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Sync Key</span>
          <small>${isPg ? 'Row identifier in database' : 'S3 object key for config'}</small>
        </div>
        <input type="text" class="setting-input" id="set-syncKey" value="${escapeHtml(cloudSyncConfig.syncKey)}" placeholder="glaceon-terminal/config.json" />
      </div>
    </div>

    ${renderSyncActions(lastSynced)}
  `;
}

function renderS3Fields(provider) {
  return `
    <h4 class="settings-section-title" style="margin-top: 24px">${provider === 'minio' ? 'MinIO' : 'AWS'} Credentials</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Access Key ID</span>
          <small>${provider === 'minio' ? 'MinIO access key' : 'IAM access key'}</small>
        </div>
        <input type="text" class="setting-input" id="set-syncAccessKey" value="${escapeHtml(cloudSyncConfig.accessKeyId)}" placeholder="AKIA..." />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Secret Access Key</span>
          <small>${provider === 'minio' ? 'MinIO secret key' : 'IAM secret key'}</small>
        </div>
        <input type="password" class="setting-input" id="set-syncSecretKey" value="${escapeHtml(cloudSyncConfig.secretAccessKey)}" placeholder="Secret key" />
      </div>
    </div>

    <h4 class="settings-section-title" style="margin-top: 24px">S3 Configuration</h4>
    <div class="settings-group">
      ${provider === 'minio' ? `
      <div class="setting-item">
        <div class="setting-label">
          <span>Endpoint</span>
          <small>MinIO server URL</small>
        </div>
        <input type="text" class="setting-input" id="set-syncEndpoint" value="${escapeHtml(cloudSyncConfig.endpoint)}" placeholder="http://localhost:9000" />
      </div>
      ` : ''}
      <div class="setting-item">
        <div class="setting-label">
          <span>Bucket</span>
          <small>S3 bucket name</small>
        </div>
        <input type="text" class="setting-input" id="set-syncBucket" value="${escapeHtml(cloudSyncConfig.bucket)}" placeholder="my-sync-bucket" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Region</span>
          <small>${provider === 'minio' ? 'MinIO region (usually us-east-1)' : 'AWS region'}</small>
        </div>
        <select class="setting-select" id="set-syncRegion">
          ${AWS_REGIONS.map((r) => `<option value="${r}" ${cloudSyncConfig.region === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}

function renderPostgreSQLFields() {
  return `
    <h4 class="settings-section-title" style="margin-top: 24px">PostgreSQL Connection</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Host</span>
          <small>Database server address</small>
        </div>
        <input type="text" class="setting-input" id="set-pgHost" value="${escapeHtml(cloudSyncConfig.pgHost)}" placeholder="localhost" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Port</span>
          <small>Default: 5432</small>
        </div>
        <input type="number" class="setting-input setting-input-sm" id="set-pgPort" value="${cloudSyncConfig.pgPort || 5432}" min="1" max="65535" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Database</span>
          <small>Database name</small>
        </div>
        <input type="text" class="setting-input" id="set-pgDatabase" value="${escapeHtml(cloudSyncConfig.pgDatabase)}" placeholder="mydb" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>User</span>
          <small>Database user</small>
        </div>
        <input type="text" class="setting-input" id="set-pgUser" value="${escapeHtml(cloudSyncConfig.pgUser)}" placeholder="postgres" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Password</span>
          <small>Database password</small>
        </div>
        <input type="password" class="setting-input" id="set-pgPassword" value="${escapeHtml(cloudSyncConfig.pgPassword)}" placeholder="Password" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Table</span>
          <small>Table name for sync data</small>
        </div>
        <input type="text" class="setting-input" id="set-pgTable" value="${escapeHtml(cloudSyncConfig.pgTable || 'cloud_sync_config')}" placeholder="cloud_sync_config" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>SSL</span>
          <small>Use SSL connection</small>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="set-pgSsl" ${cloudSyncConfig.pgSsl ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `;
}

function renderSyncActions(lastSynced) {
  return `
    <h4 class="settings-section-title" style="margin-top: 24px">Actions</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Test Connection</span>
          <small id="sync-status-text">Verify access</small>
        </div>
        <button class="setting-btn" id="btn-syncTest" style="padding: 4px 12px; border: 1px solid var(--glass-border-strong); background: var(--glass-tab); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 12px">Test</button>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Push Now</span>
          <small>Upload current settings</small>
        </div>
        <button class="setting-btn" id="btn-syncPush" style="padding: 4px 12px; border: 1px solid var(--glass-border-strong); background: var(--glass-tab); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 12px">Push</button>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Pull Now</span>
          <small>Download settings</small>
        </div>
        <button class="setting-btn" id="btn-syncPull" style="padding: 4px 12px; border: 1px solid var(--glass-border-strong); background: var(--glass-tab); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 12px">Pull</button>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Last Synced</span>
          <small id="sync-last-time">${lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}</small>
        </div>
      </div>
    </div>
  `;
}

function renderSecurity() {
  const statusLabel = encryptionStatus.isEnabled
    ? (encryptionStatus.isUnlocked ? 'Enabled & Unlocked' : 'Enabled & Locked')
    : 'Disabled';
  const statusColor = encryptionStatus.isEnabled
    ? (encryptionStatus.isUnlocked ? '#9ece6a' : '#e0af68')
    : '#565f89';

  return `
    <h4 class="settings-section-title">Encryption</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Status</span>
          <small style="color:${statusColor}">${statusLabel}</small>
        </div>
      </div>
      ${!encryptionStatus.isEnabled ? `
      <div class="setting-item">
        <div class="setting-label">
          <span>Key Source</span>
          <small>Choose how to derive the encryption key</small>
        </div>
        <select class="setting-select" id="set-encKeySource">
          <option value="custom">Custom Master Key</option>
          <option value="iam">IAM Secret Key (auto-unlock)</option>
        </select>
      </div>
      <div id="enc-custom-key-group">
        <div class="setting-item">
          <div class="setting-label">
            <span>Master Key</span>
            <small>Min 8 characters</small>
          </div>
          <input type="password" class="setting-input" id="set-encPassword" placeholder="Enter master key" autocomplete="off" />
        </div>
        <div class="setting-item">
          <div class="setting-label">
            <span>Confirm Key</span>
            <small>Re-enter to confirm</small>
          </div>
          <input type="password" class="setting-input" id="set-encPasswordConfirm" placeholder="Confirm master key" autocomplete="off" />
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Enable Encryption</span>
          <small id="enc-status-text">Encrypt sensitive data at rest</small>
        </div>
        <button class="setting-btn" id="btn-encEnable" style="padding:4px 12px;border:1px solid var(--glass-border-strong);background:var(--accent,#7aa2f7);color:#1a1b26;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">Enable</button>
      </div>
      ` : `
      <div class="setting-item">
        <div class="setting-label">
          <span>Key Source</span>
          <small>${encryptionStatus.keySource === 'iam' ? 'IAM Secret Key (auto-unlock)' : 'Custom Master Key'}</small>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Disable Encryption</span>
          <small id="enc-status-text">Decrypt all fields and remove protection</small>
        </div>
        <button class="setting-btn" id="btn-encDisable" style="padding:4px 12px;border:1px solid var(--glass-border-strong);background:#f7768e;color:#1a1b26;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">Disable</button>
      </div>
      `}
    </div>

    ${encryptionStatus.isEnabled && encryptionStatus.keySource === 'custom' ? `
    <h4 class="settings-section-title" style="margin-top:24px">Change Master Key</h4>
    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <span>Current Key</span>
        </div>
        <input type="password" class="setting-input" id="set-encOldPassword" placeholder="Current master key" autocomplete="off" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>New Key</span>
          <small>Min 8 characters</small>
        </div>
        <input type="password" class="setting-input" id="set-encNewPassword" placeholder="New master key" autocomplete="off" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>Confirm New Key</span>
        </div>
        <input type="password" class="setting-input" id="set-encNewPasswordConfirm" placeholder="Confirm new key" autocomplete="off" />
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span id="enc-change-status"></span>
        </div>
        <button class="setting-btn" id="btn-encChange" style="padding:4px 12px;border:1px solid var(--glass-border-strong);background:var(--glass-tab);color:var(--text-primary);border-radius:6px;cursor:pointer;font-size:12px">Change Key</button>
      </div>
    </div>
    ` : ''}
  `;
}

function saveCloudSyncConfig() {
  if (window.syncAPI) {
    const { _lastSynced, ...config } = cloudSyncConfig;
    window.syncAPI.setConfig(config);
  }
}

function triggerAutoSync() {
  if (!cloudSyncConfig.enabled) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(async () => {
    try {
      if (window.syncAPI) await window.syncAPI.push();
    } catch (e) {
      // silent auto-push failure
    }
  }, 500);
}

function attachSectionEvents() {
  if (!panelEl) return;

  // General settings
  const inputs = {
    fontFamily: 'set-fontFamily',
    fontSize: 'set-fontSize',
    cursorStyle: 'set-cursorStyle',
    cursorBlink: 'set-cursorBlink',
    scrollback: 'set-scrollback',
    defaultShell: 'set-defaultShell',
    defaultEditor: 'set-defaultEditor',
    notificationsEnabled: 'set-notificationsEnabled',
    notificationThreshold: 'set-notificationThreshold',
    restoreSession: 'set-restoreSession',
    loggingEnabled: 'set-loggingEnabled',
    logDirectory: 'set-logDirectory',
  };

  for (const [key, id] of Object.entries(inputs)) {
    const el = panelEl.querySelector(`#${id}`);
    if (!el) continue;

    const eventType = el.type === 'checkbox' ? 'change' : el.type === 'range' ? 'input' : 'change';
    el.addEventListener(eventType, () => {
      if (el.type === 'checkbox') {
        settings[key] = el.checked;
      } else if (el.type === 'number' || el.type === 'range') {
        settings[key] = parseFloat(el.value);
        // Update label for range
        const label = el.closest('.setting-item')?.querySelector('small');
        if (label && el.type === 'range') label.textContent = el.value;
      } else {
        settings[key] = el.value;
      }
      saveSettings();
    });
  }

  // Opacity slider — live preview
  const opacitySlider = panelEl.querySelector('#set-terminalOpacity');
  const opacityLabel = panelEl.querySelector('#opacity-percent-label');
  const fullOpacityToggle = panelEl.querySelector('#set-fullOpacity');

  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      const val = parseFloat(opacitySlider.value);
      settings.terminalOpacity = val;
      if (opacityLabel) opacityLabel.textContent = Math.round(val * 100) + '%';
      if (fullOpacityToggle) fullOpacityToggle.checked = val >= 1.0;
      if (themeEngineMod) themeEngineMod.applyOpacity(val);
      saveSettings();
    });
  }

  if (fullOpacityToggle) {
    fullOpacityToggle.addEventListener('change', () => {
      const newVal = fullOpacityToggle.checked ? 1.0 : 0.72;
      settings.terminalOpacity = newVal;
      if (opacitySlider) opacitySlider.value = newVal;
      if (opacityLabel) opacityLabel.textContent = Math.round(newVal * 100) + '%';
      if (themeEngineMod) themeEngineMod.applyOpacity(newVal);
      saveSettings();
    });
  }

  // Background settings
  const bgTypeSelect = panelEl.querySelector('#set-bgType');
  const bgColorGroup = panelEl.querySelector('#bg-color-group');
  const bgImageGroup = panelEl.querySelector('#bg-image-group');
  const bgColorInput = panelEl.querySelector('#set-bgColor');
  const bgImageBtn = panelEl.querySelector('#btn-bgImage');
  const bgScaleSelect = panelEl.querySelector('#set-bgScale');
  const bgOpacitySlider = panelEl.querySelector('#set-bgOpacity');
  const bgOpacityLabel = panelEl.querySelector('#bg-opacity-label');
  const bgImagePath = panelEl.querySelector('#bg-image-path');

  if (bgTypeSelect) {
    bgTypeSelect.addEventListener('change', () => {
      background.type = bgTypeSelect.value;
      if (bgColorGroup) bgColorGroup.style.display = background.type === 'color' ? 'block' : 'none';
      if (bgImageGroup) bgImageGroup.style.display = background.type === 'image' ? 'block' : 'none';
      saveBackground();
      applyBackground(background);
    });
  }

  if (bgColorInput) {
    bgColorInput.addEventListener('input', () => {
      background.color = bgColorInput.value;
      saveBackground();
      applyBackground(background);
    });
  }

  if (bgImageBtn) {
    bgImageBtn.addEventListener('click', async () => {
      const paths = await window.dialogAPI.showOpen({
        title: 'Select Background Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }],
        properties: ['openFile'],
      });
      if (paths && paths.length > 0) {
        const dataUrl = await window.fileAPI.readBase64(paths[0]);
        if (dataUrl) {
          background.imagePath = paths[0];
          background.imageData = dataUrl;
          if (bgImagePath) bgImagePath.textContent = paths[0].split('/').pop();
          saveBackground();
          applyBackground(background);
        }
      }
    });
  }

  if (bgScaleSelect) {
    bgScaleSelect.addEventListener('change', () => {
      background.imageScale = bgScaleSelect.value;
      saveBackground();
      applyBackground(background);
    });
  }

  if (bgOpacitySlider) {
    bgOpacitySlider.addEventListener('input', () => {
      background.imageOpacity = parseFloat(bgOpacitySlider.value);
      if (bgOpacityLabel) bgOpacityLabel.textContent = Math.round(background.imageOpacity * 100) + '%';
      applyBackground(background);
    });
    bgOpacitySlider.addEventListener('change', () => {
      saveBackground();
    });
  }

  // Notification Rules (F10)
  const addRuleBtn = panelEl.querySelector('#btn-add-notification-rule');
  if (addRuleBtn) {
    loadNotificationRules().then(() => renderNotificationRules());
    addRuleBtn.addEventListener('click', () => showRuleEditor(null));
  }

  // Cloud Sync settings — provider dropdown triggers re-render
  const providerSelect = panelEl.querySelector('#set-syncProvider');
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      cloudSyncConfig.provider = providerSelect.value;
      saveCloudSyncConfig();
      render();
    });
  }

  const syncInputs = {
    syncEnabled: { id: 'set-syncEnabled', field: 'enabled', checkbox: true },
    syncAccessKey: { id: 'set-syncAccessKey', field: 'accessKeyId' },
    syncSecretKey: { id: 'set-syncSecretKey', field: 'secretAccessKey' },
    syncBucket: { id: 'set-syncBucket', field: 'bucket' },
    syncRegion: { id: 'set-syncRegion', field: 'region' },
    syncEndpoint: { id: 'set-syncEndpoint', field: 'endpoint' },
    syncKey: { id: 'set-syncKey', field: 'syncKey' },
    pgHost: { id: 'set-pgHost', field: 'pgHost' },
    pgPort: { id: 'set-pgPort', field: 'pgPort', number: true },
    pgDatabase: { id: 'set-pgDatabase', field: 'pgDatabase' },
    pgUser: { id: 'set-pgUser', field: 'pgUser' },
    pgPassword: { id: 'set-pgPassword', field: 'pgPassword' },
    pgTable: { id: 'set-pgTable', field: 'pgTable' },
    pgSsl: { id: 'set-pgSsl', field: 'pgSsl', checkbox: true },
  };

  for (const [, def] of Object.entries(syncInputs)) {
    const el = panelEl.querySelector(`#${def.id}`);
    if (!el) continue;
    el.addEventListener('change', () => {
      if (def.checkbox) cloudSyncConfig[def.field] = el.checked;
      else if (def.number) cloudSyncConfig[def.field] = parseInt(el.value, 10) || 0;
      else cloudSyncConfig[def.field] = el.value;
      saveCloudSyncConfig();
    });
  }

  const syncTestBtn = panelEl.querySelector('#btn-syncTest');
  const syncStatusText = panelEl.querySelector('#sync-status-text');
  if (syncTestBtn) {
    syncTestBtn.addEventListener('click', async () => {
      if (syncStatusText) syncStatusText.textContent = 'Testing...';
      try {
        const result = await window.syncAPI.test();
        if (syncStatusText) syncStatusText.textContent = result.success ? result.message : `Error: ${result.error}`;
      } catch (e) {
        if (syncStatusText) syncStatusText.textContent = `Error: ${e.message}`;
      }
    });
  }

  const syncPushBtn = panelEl.querySelector('#btn-syncPush');
  if (syncPushBtn) {
    syncPushBtn.addEventListener('click', async () => {
      try {
        const result = await window.syncAPI.push();
        if (result.success) {
          const lastTimeEl = panelEl.querySelector('#sync-last-time');
          if (lastTimeEl) lastTimeEl.textContent = new Date().toLocaleString();
        } else {
          const statusEl = panelEl.querySelector('#sync-status-text');
          if (statusEl) statusEl.textContent = `Push failed: ${result.error}`;
        }
      } catch (e) {
        const statusEl = panelEl.querySelector('#sync-status-text');
        if (statusEl) statusEl.textContent = `Push failed: ${e.message}`;
      }
    });
  }

  const syncPullBtn = panelEl.querySelector('#btn-syncPull');
  if (syncPullBtn) {
    syncPullBtn.addEventListener('click', async () => {
      try {
        const result = await window.syncAPI.pull();
        if (result.error) {
          const statusEl = panelEl.querySelector('#sync-status-text');
          if (statusEl) statusEl.textContent = `Pull failed: ${result.error}`;
          return;
        }
        if (!result.data) {
          const statusEl = panelEl.querySelector('#sync-status-text');
          if (statusEl) statusEl.textContent = 'No remote config found';
          return;
        }
        const confirmed = confirm('Remote config found. Apply remote settings? This will overwrite your current settings.');
        if (confirmed) {
          await window.syncAPI.applyPull(result.data);
          const lastTimeEl = panelEl.querySelector('#sync-last-time');
          if (lastTimeEl) lastTimeEl.textContent = new Date().toLocaleString();
        }
      } catch (e) {
        const statusEl = panelEl.querySelector('#sync-status-text');
        if (statusEl) statusEl.textContent = `Pull failed: ${e.message}`;
      }
    });
  }

  // Security / Encryption
  const encKeySourceSelect = panelEl.querySelector('#set-encKeySource');
  const encCustomGroup = panelEl.querySelector('#enc-custom-key-group');

  if (encKeySourceSelect && encCustomGroup) {
    encKeySourceSelect.addEventListener('change', () => {
      encCustomGroup.style.display = encKeySourceSelect.value === 'custom' ? 'block' : 'none';
    });
  }

  const encEnableBtn = panelEl.querySelector('#btn-encEnable');
  if (encEnableBtn) {
    encEnableBtn.addEventListener('click', async () => {
      const statusText = panelEl.querySelector('#enc-status-text');
      const keySource = encKeySourceSelect ? encKeySourceSelect.value : 'custom';

      if (keySource === 'custom') {
        const pw = panelEl.querySelector('#set-encPassword')?.value || '';
        const pwConfirm = panelEl.querySelector('#set-encPasswordConfirm')?.value || '';
        if (pw.length < 8) { if (statusText) statusText.textContent = 'Key must be at least 8 characters'; return; }
        if (pw !== pwConfirm) { if (statusText) statusText.textContent = 'Keys do not match'; return; }
        if (statusText) statusText.textContent = 'Enabling...';
        const result = await window.encryptionAPI.setup(pw, 'custom');
        if (result.success) {
          encryptionStatus = await window.encryptionAPI.getStatus();
          render();
        } else {
          if (statusText) statusText.textContent = `Error: ${result.error}`;
        }
      } else {
        // IAM key source
        if (statusText) statusText.textContent = 'Enabling with IAM key...';
        const result = await window.encryptionAPI.setup('', 'iam');
        if (result.success) {
          encryptionStatus = await window.encryptionAPI.getStatus();
          render();
        } else {
          if (statusText) statusText.textContent = `Error: ${result.error}`;
        }
      }
    });
  }

  const encDisableBtn = panelEl.querySelector('#btn-encDisable');
  if (encDisableBtn) {
    encDisableBtn.addEventListener('click', async () => {
      const statusText = panelEl.querySelector('#enc-status-text');
      const confirmed = confirm('This will decrypt all fields and remove encryption protection. Continue?');
      if (!confirmed) return;

      if (encryptionStatus.keySource === 'custom' && !encryptionStatus.isUnlocked) {
        const pw = prompt('Enter your current master key to disable encryption:');
        if (!pw) return;
        if (statusText) statusText.textContent = 'Disabling...';
        const result = await window.encryptionAPI.disable(pw);
        if (result.success) {
          encryptionStatus = await window.encryptionAPI.getStatus();
          render();
        } else {
          if (statusText) statusText.textContent = `Error: ${result.error}`;
        }
      } else {
        if (statusText) statusText.textContent = 'Disabling...';
        const result = await window.encryptionAPI.disable('');
        if (result.success) {
          encryptionStatus = await window.encryptionAPI.getStatus();
          render();
        } else {
          if (statusText) statusText.textContent = `Error: ${result.error}`;
        }
      }
    });
  }

  const encChangeBtn = panelEl.querySelector('#btn-encChange');
  if (encChangeBtn) {
    encChangeBtn.addEventListener('click', async () => {
      const changeStatus = panelEl.querySelector('#enc-change-status');
      const oldPw = panelEl.querySelector('#set-encOldPassword')?.value || '';
      const newPw = panelEl.querySelector('#set-encNewPassword')?.value || '';
      const newPwConfirm = panelEl.querySelector('#set-encNewPasswordConfirm')?.value || '';

      if (!oldPw) { if (changeStatus) changeStatus.textContent = 'Enter current key'; return; }
      if (newPw.length < 8) { if (changeStatus) changeStatus.textContent = 'New key must be at least 8 characters'; return; }
      if (newPw !== newPwConfirm) { if (changeStatus) changeStatus.textContent = 'New keys do not match'; return; }

      if (changeStatus) changeStatus.textContent = 'Changing...';
      const result = await window.encryptionAPI.changePassword(oldPw, newPw);
      if (result.success) {
        if (changeStatus) changeStatus.textContent = 'Key changed successfully';
        encryptionStatus = await window.encryptionAPI.getStatus();
      } else {
        if (changeStatus) changeStatus.textContent = `Error: ${result.error}`;
      }
    });
  }

  // Theme cards
  panelEl.querySelectorAll('.theme-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (themeEngineMod) {
        themeEngineMod.applyTheme(card.dataset.themeId);
        // Re-apply saved opacity on top of new theme
        if (settings.terminalOpacity < 1.0) {
          themeEngineMod.applyOpacity(settings.terminalOpacity);
        }
        themeEngineMod.renderThemePicker();
        render(); // re-render to update active state
      }
    });
  });
}

function saveBackground() {
  if (window.settingsAPI) {
    window.settingsAPI.set('background', background);
  }
}

function applyBackground(bg) {
  const el = document.getElementById('app-background');
  const shell = document.getElementById('app-shell');
  if (!el) return;

  if (!bg || bg.type === 'none') {
    el.style.background = 'transparent';
    el.style.opacity = '1';
    // Restore default backdrop-filter from CSS
    if (shell) {
      shell.style.backdropFilter = '';
      shell.style.webkitBackdropFilter = '';
    }
  } else if (bg.type === 'color') {
    el.style.background = bg.color;
    el.style.opacity = '1';
    if (shell) {
      shell.style.backdropFilter = '';
      shell.style.webkitBackdropFilter = '';
    }
  } else if (bg.type === 'image' && (bg.imageData || bg.imagePath)) {
    const src = bg.imageData || `file://${bg.imagePath}`;
    const size = bg.imageScale === 'fill' ? '100% 100%' : bg.imageScale || 'cover';
    el.style.background = `url("${src}") center/${size} no-repeat`;
    el.style.opacity = String(bg.imageOpacity != null ? bg.imageOpacity : 1.0);
    // Remove blur from backdrop-filter so the background image stays sharp
    if (shell) {
      shell.style.backdropFilter = 'saturate(var(--glass-saturation, 1.4))';
      shell.style.webkitBackdropFilter = 'saturate(var(--glass-saturation, 1.4))';
    }
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getSettings() {
  return settings;
}

module.exports = {
  init,
  open,
  close,
  toggle,
  loadSettings,
  getSettings,
  applyBackground,
  triggerAutoSync,
};
