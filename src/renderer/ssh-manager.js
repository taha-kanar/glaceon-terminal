// ── SSH Manager ──
// Parse ~/.ssh/config, manage saved connections, connect via tab

let savedConnections = [];
let configEntries = [];
let modalEl = null;
let isOpen = false;
let currentView = 'browser'; // 'browser' | 'editor'
let editingConnection = null;
let onConnectFn = null; // (sshCommand, label, color) => void

function init(opts) {
  onConnectFn = opts.onConnect;
}

async function loadConnections() {
  if (window.sshAPI) {
    savedConnections = await window.sshAPI.getSaved();
    try {
      const configText = await window.sshAPI.parseConfig();
      configEntries = parseSSHConfig(configText || '');
    } catch (e) {
      configEntries = [];
    }
  }
}

function parseSSHConfig(text) {
  const entries = [];
  let current = null;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^(\w+)\s+(.+)$/);
    if (!match) continue;

    const key = match[1].toLowerCase();
    const value = match[2];

    if (key === 'host') {
      if (current && current.host !== '*') entries.push(current);
      current = { host: value, hostname: '', user: '', port: '22', identityFile: '', source: 'config' };
    } else if (current) {
      if (key === 'hostname') current.hostname = value;
      else if (key === 'user') current.user = value;
      else if (key === 'port') current.port = value;
      else if (key === 'identityfile') current.identityFile = value;
    }
  }

  if (current && current.host !== '*') entries.push(current);
  return entries;
}

function getMergedConnections() {
  const merged = [];
  const savedIds = new Set(savedConnections.map((c) => c.id));

  // Add config entries that aren't overridden by saved
  for (const entry of configEntries) {
    const saved = savedConnections.find((c) => c.host === entry.host);
    if (saved) {
      merged.push({ ...entry, ...saved, source: 'both' });
    } else {
      merged.push({ ...entry, id: 'config-' + entry.host });
    }
  }

  // Add saved connections not in config
  for (const saved of savedConnections) {
    if (!configEntries.find((c) => c.host === saved.host)) {
      merged.push(saved);
    }
  }

  return merged;
}

function open() {
  if (isOpen) return;
  isOpen = true;
  currentView = 'browser';
  editingConnection = null;
  loadConnections().then(() => render());
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  modalEl = document.getElementById('ssh-manager-modal');
  if (modalEl) {
    modalEl.classList.remove('open');
    modalEl.innerHTML = '';
  }
}

function toggle() {
  if (isOpen) close();
  else open();
}

function render() {
  modalEl = document.getElementById('ssh-manager-modal');
  if (!modalEl) return;

  if (currentView === 'browser') renderBrowser();
  else renderEditor();

  modalEl.classList.add('open');
}

function renderBrowser() {
  const connections = getMergedConnections();

  modalEl.innerHTML = `
    <div class="modal-backdrop" data-close="true"></div>
    <div class="modal-content ssh-modal">
      <div class="modal-header">
        <h3>SSH Connections</h3>
        <button class="modal-close" data-close="true">&times;</button>
      </div>
      <div class="ssh-toolbar">
        <input type="text" class="ssh-search" placeholder="Search connections..." autocomplete="off" spellcheck="false" />
        <button class="btn btn-primary ssh-add-btn">+ Add</button>
      </div>
      <div class="ssh-list">
        ${connections.length === 0
          ? '<div class="ssh-empty">No SSH connections found. Add one or configure ~/.ssh/config.</div>'
          : connections.map((c) => `
            <div class="ssh-item" data-host="${escapeHtml(c.host)}" data-name="${escapeHtml(c.name || c.host)}">
              <div class="ssh-source-badge ${c.source || 'saved'}">${c.source === 'config' ? 'config' : c.source === 'both' ? 'config+saved' : 'saved'}</div>
              <div class="ssh-info">
                <span class="ssh-name">${escapeHtml(c.name || c.host)}</span>
                <span class="ssh-details">${escapeHtml(c.user ? c.user + '@' : '')}${escapeHtml(c.hostname || c.host)}${c.port !== '22' ? ':' + c.port : ''}</span>
              </div>
              <div class="ssh-actions">
                <button class="snippet-btn ssh-connect" data-host="${escapeHtml(c.host)}" title="Connect">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="4 17 10 11 4 5"></polyline>
                    <line x1="12" y1="19" x2="20" y2="19"></line>
                  </svg>
                </button>
                ${c.source !== 'config' ? `
                  <button class="snippet-btn ssh-edit" data-host="${escapeHtml(c.host)}" title="Edit">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button class="snippet-btn ssh-delete" data-host="${escapeHtml(c.host)}" title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;

  // Events
  modalEl.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  modalEl.querySelector('.ssh-add-btn').addEventListener('click', () => {
    editingConnection = null;
    currentView = 'editor';
    render();
  });

  // Search
  const searchInput = modalEl.querySelector('.ssh-search');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    modalEl.querySelectorAll('.ssh-item').forEach((el) => {
      const host = el.dataset.host.toLowerCase();
      const name = (el.dataset.name || '').toLowerCase();
      el.style.display = (host.includes(q) || name.includes(q)) ? '' : 'none';
    });
  });

  // List actions
  modalEl.querySelector('.ssh-list').addEventListener('click', async (e) => {
    const connectBtn = e.target.closest('.ssh-connect');
    if (connectBtn) {
      const conn = getMergedConnections().find((c) => c.host === connectBtn.dataset.host);
      if (conn) connectSSH(conn);
      return;
    }

    const editBtn = e.target.closest('.ssh-edit');
    if (editBtn) {
      const conn = getMergedConnections().find((c) => c.host === editBtn.dataset.host);
      if (conn) {
        editingConnection = conn;
        currentView = 'editor';
        render();
      }
      return;
    }

    const deleteBtn = e.target.closest('.ssh-delete');
    if (deleteBtn) {
      const conn = savedConnections.find((c) => c.host === deleteBtn.dataset.host);
      if (conn && window.sshAPI) {
        await window.sshAPI.delete(conn.id);
        savedConnections = savedConnections.filter((c) => c.id !== conn.id);
        render();
      }
    }
  });

  searchInput.focus();
}

function renderEditor() {
  const c = editingConnection || { name: '', host: '', hostname: '', user: '', port: '22', identityFile: '', password: '', color: '' };

  modalEl.innerHTML = `
    <div class="modal-backdrop" data-close="true"></div>
    <div class="modal-content ssh-modal">
      <div class="modal-header">
        <h3>${editingConnection ? 'Edit Connection' : 'New Connection'}</h3>
        <button class="modal-close" data-close="true">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="ssh-name" value="${escapeHtml(c.name || '')}" placeholder="e.g. Production Server" />
          <span class="form-hint">A friendly name for this connection</span>
        </div>
        <div class="form-group">
          <label>Hostname / IP</label>
          <input type="text" id="ssh-hostname" value="${escapeHtml(c.hostname || '')}" placeholder="e.g. 192.168.1.100 or myserver.com" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>User</label>
            <input type="text" id="ssh-user" value="${escapeHtml(c.user || '')}" placeholder="e.g. root" />
          </div>
          <div class="form-group">
            <label>Port</label>
            <input type="text" id="ssh-port" value="${escapeHtml(c.port || '22')}" placeholder="22" />
          </div>
        </div>
        <div class="form-group">
          <label>Password (optional)</label>
          <input type="password" id="ssh-password" value="${escapeHtml(c.password || '')}" placeholder="Leave empty for key-based auth" autocomplete="off" />
          <span class="form-hint">Stored encrypted if encryption is enabled</span>
        </div>
        <div class="form-group">
          <label>Identity File (optional)</label>
          <input type="text" id="ssh-identity" value="${escapeHtml(c.identityFile || '')}" placeholder="~/.ssh/id_rsa" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="ssh-back">Back</button>
        <button class="btn btn-primary" id="ssh-save">Save</button>
      </div>
    </div>
  `;

  modalEl.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  modalEl.querySelector('#ssh-back').addEventListener('click', () => {
    currentView = 'browser';
    render();
  });

  modalEl.querySelector('#ssh-save').addEventListener('click', async () => {
    const name = modalEl.querySelector('#ssh-name').value.trim();
    const hostname = modalEl.querySelector('#ssh-hostname').value.trim();
    const user = modalEl.querySelector('#ssh-user').value.trim();
    const port = modalEl.querySelector('#ssh-port').value.trim() || '22';
    const password = modalEl.querySelector('#ssh-password').value;
    const identityFile = modalEl.querySelector('#ssh-identity').value.trim();

    if (!hostname) return;

    const connection = {
      id: editingConnection ? editingConnection.id : 'ssh-' + Date.now(),
      name: name || hostname,
      host: name || hostname,
      hostname,
      user,
      port,
      password,
      identityFile,
      source: 'saved',
    };

    if (window.sshAPI) await window.sshAPI.save(connection);

    const idx = savedConnections.findIndex((c) => c.id === connection.id);
    if (idx >= 0) savedConnections[idx] = connection;
    else savedConnections.push(connection);

    currentView = 'browser';
    render();
  });
}

function connectSSH(conn) {
  const password = conn.password || '';
  let cmd = '';

  if (password) {
    cmd = `sshpass -p ${shellEscape(password)} ssh -o StrictHostKeyChecking=accept-new`;
  } else {
    cmd = 'ssh';
  }

  if (conn.user) cmd += ` ${conn.user}@${conn.hostname || conn.host}`;
  else cmd += ` ${conn.hostname || conn.host}`;
  if (conn.port && conn.port !== '22') cmd += ` -p ${conn.port}`;
  if (conn.identityFile) cmd += ` -i ${conn.identityFile}`;
  cmd += ' -o ServerAliveInterval=60 -o ServerAliveCountMax=3';

  close();
  if (onConnectFn) onConnectFn(cmd + '\n', `SSH: ${conn.name || conn.host}`);
}

function shellEscape(str) {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  init,
  open,
  close,
  toggle,
  loadConnections,
};
