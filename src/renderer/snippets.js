// ── Snippet Manager ──
// CRUD snippets with variable interpolation, categories, search

let snippets = [];
let modalEl = null;
let isOpen = false;
let currentView = 'browser'; // 'browser' | 'editor'
let editingSnippet = null;
let onPasteToTerminalFn = null;

function init(opts) {
  onPasteToTerminalFn = opts.onPasteToTerminal;
}

async function loadSnippets() {
  if (window.snippetAPI) {
    snippets = await window.snippetAPI.getAll();
  }
}

function open() {
  if (isOpen) return;
  isOpen = true;
  currentView = 'browser';
  editingSnippet = null;
  loadSnippets().then(() => render());
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  modalEl = document.getElementById('snippet-manager-modal');
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
  modalEl = document.getElementById('snippet-manager-modal');
  if (!modalEl) return;

  if (currentView === 'browser') renderBrowser();
  else renderEditor();

  modalEl.classList.add('open');
}

function renderBrowser() {
  const categories = [...new Set(snippets.map((s) => s.category || 'Uncategorized'))].sort();

  modalEl.innerHTML = `
    <div class="modal-backdrop" data-close="true"></div>
    <div class="modal-content snippet-modal">
      <div class="modal-header">
        <h3>Snippets</h3>
        <button class="modal-close" data-close="true">&times;</button>
      </div>
      <div class="snippet-toolbar">
        <input type="text" class="snippet-search" placeholder="Search snippets..." autocomplete="off" spellcheck="false" />
        <button class="btn btn-primary snippet-add-btn">+ New</button>
      </div>
      <div class="snippet-list">
        ${snippets.length === 0
          ? '<div class="snippet-empty">No snippets yet. Click + New to create one.</div>'
          : categories.map((cat) => `
            <div class="snippet-category-header">${cat}</div>
            ${snippets
              .filter((s) => (s.category || 'Uncategorized') === cat)
              .map((s) => `
                <div class="snippet-item" data-id="${s.id}">
                  <div class="snippet-info">
                    <span class="snippet-name">${escapeHtml(s.name)}</span>
                    <span class="snippet-command-preview">${escapeHtml(truncate(s.command, 60))}</span>
                  </div>
                  <div class="snippet-actions">
                    <button class="snippet-btn snippet-paste" data-id="${s.id}" title="Paste">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="4 17 10 11 4 5"></polyline>
                        <line x1="12" y1="19" x2="20" y2="19"></line>
                      </svg>
                    </button>
                    <button class="snippet-btn snippet-edit" data-id="${s.id}" title="Edit">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button class="snippet-btn snippet-delete" data-id="${s.id}" title="Delete">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              `).join('')
            }
          `).join('')
        }
      </div>
    </div>
  `;

  // Events
  modalEl.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  modalEl.querySelector('.snippet-add-btn').addEventListener('click', () => {
    editingSnippet = null;
    currentView = 'editor';
    render();
  });

  // Search
  const searchInput = modalEl.querySelector('.snippet-search');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    modalEl.querySelectorAll('.snippet-item').forEach((el) => {
      const s = snippets.find((sn) => sn.id === el.dataset.id);
      if (s) {
        const match = s.name.toLowerCase().includes(q) || s.command.toLowerCase().includes(q);
        el.style.display = match ? '' : 'none';
      }
    });
  });

  // Paste, Edit, Delete
  modalEl.querySelector('.snippet-list').addEventListener('click', async (e) => {
    const pasteBtn = e.target.closest('.snippet-paste');
    if (pasteBtn) {
      const snippet = snippets.find((s) => s.id === pasteBtn.dataset.id);
      if (snippet) await pasteSnippet(snippet);
      return;
    }

    const editBtn = e.target.closest('.snippet-edit');
    if (editBtn) {
      editingSnippet = snippets.find((s) => s.id === editBtn.dataset.id);
      currentView = 'editor';
      render();
      return;
    }

    const deleteBtn = e.target.closest('.snippet-delete');
    if (deleteBtn) {
      if (window.snippetAPI) await window.snippetAPI.delete(deleteBtn.dataset.id);
      snippets = snippets.filter((s) => s.id !== deleteBtn.dataset.id);
      render();
    }
  });

  searchInput.focus();
}

function renderEditor() {
  const s = editingSnippet || { name: '', command: '', category: '', variables: [] };

  modalEl.innerHTML = `
    <div class="modal-backdrop" data-close="true"></div>
    <div class="modal-content snippet-modal">
      <div class="modal-header">
        <h3>${editingSnippet ? 'Edit Snippet' : 'New Snippet'}</h3>
        <button class="modal-close" data-close="true">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="snippet-name" value="${escapeHtml(s.name)}" placeholder="e.g. Docker build" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <input type="text" id="snippet-category" value="${escapeHtml(s.category || '')}" placeholder="e.g. Docker, Git, SSH" />
        </div>
        <div class="form-group">
          <label>Command</label>
          <textarea id="snippet-command" rows="4" placeholder="e.g. docker build -t \${1:image_name} .">${escapeHtml(s.command)}</textarea>
          <small class="form-hint">Use \${N:default} for variables, e.g. \${1:image_name}</small>
        </div>
        <div id="snippet-vars-preview"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="snippet-back">Back</button>
        <button class="btn btn-primary" id="snippet-save">Save</button>
      </div>
    </div>
  `;

  modalEl.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  modalEl.querySelector('#snippet-back').addEventListener('click', () => {
    currentView = 'browser';
    render();
  });

  // Preview variables on command change
  const cmdInput = modalEl.querySelector('#snippet-command');
  cmdInput.addEventListener('input', () => {
    updateVarsPreview(cmdInput.value);
  });
  updateVarsPreview(cmdInput.value);

  modalEl.querySelector('#snippet-save').addEventListener('click', async () => {
    const name = modalEl.querySelector('#snippet-name').value.trim();
    const category = modalEl.querySelector('#snippet-category').value.trim();
    const command = modalEl.querySelector('#snippet-command').value;

    if (!name || !command) return;

    const variables = parseVariables(command);
    const snippet = {
      id: editingSnippet ? editingSnippet.id : 'snippet-' + Date.now(),
      name,
      command,
      category,
      variables,
      createdAt: editingSnippet ? editingSnippet.createdAt : new Date().toISOString(),
    };

    if (window.snippetAPI) await window.snippetAPI.save(snippet);

    const idx = snippets.findIndex((s) => s.id === snippet.id);
    if (idx >= 0) snippets[idx] = snippet;
    else snippets.push(snippet);

    currentView = 'browser';
    render();
  });
}

function updateVarsPreview(command) {
  const vars = parseVariables(command);
  const preview = document.getElementById('snippet-vars-preview');
  if (!preview) return;

  if (vars.length === 0) {
    preview.innerHTML = '';
    return;
  }

  preview.innerHTML = `
    <div class="snippet-vars-label">Detected variables:</div>
    ${vars.map((v) => `<span class="snippet-var-tag">\${${v.name}} = "${v.default}"</span>`).join(' ')}
  `;
}

function parseVariables(command) {
  const regex = /\$\{(\d+):([^}]*)\}/g;
  const vars = [];
  const seen = new Set();
  let match;

  while ((match = regex.exec(command)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      vars.push({ name, default: match[2] });
    }
  }
  return vars;
}

async function pasteSnippet(snippet) {
  let command = snippet.command;
  const vars = parseVariables(command);

  if (vars.length > 0) {
    // Prompt for each variable
    for (const v of vars) {
      const value = await promptVariable(v.name, v.default);
      if (value === null) return; // cancelled
      const regex = new RegExp(`\\$\\{${v.name}:[^}]*\\}`, 'g');
      command = command.replace(regex, value);
    }
  }

  close();
  if (onPasteToTerminalFn) onPasteToTerminalFn(command);
}

function promptVariable(name, defaultValue) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'snippet-prompt-overlay';
    overlay.innerHTML = `
      <div class="snippet-prompt">
        <div class="snippet-prompt-title">Variable \${${name}}</div>
        <input type="text" class="snippet-prompt-input" value="${escapeHtml(defaultValue)}" />
        <div class="snippet-prompt-buttons">
          <button class="btn btn-secondary snippet-prompt-cancel">Cancel</button>
          <button class="btn btn-primary snippet-prompt-ok">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('.snippet-prompt-input');
    input.focus();
    input.select();

    function done(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.querySelector('.snippet-prompt-cancel').addEventListener('click', () => done(null));
    overlay.querySelector('.snippet-prompt-ok').addEventListener('click', () => done(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value);
      if (e.key === 'Escape') done(null);
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

module.exports = {
  init,
  open,
  close,
  toggle,
  loadSnippets,
};
