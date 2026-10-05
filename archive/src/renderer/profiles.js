let profiles = [];
let onProfileSelect = null; // callback(profileId)

async function loadProfiles() {
  if (window.profileAPI) {
    profiles = await window.profileAPI.getAll();
  }
  return profiles;
}

function getProfiles() {
  return profiles;
}

function getProfile(id) {
  return profiles.find((p) => p.id === id);
}

function getDefaultProfile() {
  return profiles.find((p) => p.isDefault) || null;
}

function setOnProfileSelect(callback) {
  onProfileSelect = callback;
}

function showProfileSelector(anchorEl) {
  let selector = document.getElementById('profile-selector');
  if (!selector) {
    selector = document.createElement('div');
    selector.id = 'profile-selector';
    document.body.appendChild(selector);
  }

  const rect = anchorEl.getBoundingClientRect();
  selector.style.left = rect.left + 'px';
  selector.style.top = (rect.bottom + 4) + 'px';

  renderProfileSelector(selector);
  selector.classList.add('open');

  const closeHandler = (e) => {
    if (!e.target.closest('#profile-selector') && !e.target.closest('#btn-new-tab')) {
      selector.classList.remove('open');
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

function renderProfileSelector(container) {
  const defaultOpt = `
    <div class="profile-option default" data-profile="">
      <span class="profile-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      </span>
      <span class="profile-name">Default Shell</span>
    </div>
  `;

  const profileOpts = profiles.map((p) => `
    <div class="profile-option ${p.isDefault ? 'default' : ''}" data-profile="${p.id}">
      <span class="profile-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </span>
      <span class="profile-name">${p.name}</span>
      <span class="profile-shell">${p.shell || ''}</span>
    </div>
  `).join('');

  container.innerHTML = `
    ${defaultOpt}
    ${profiles.length > 0 ? '<div class="profile-separator"></div>' : ''}
    ${profileOpts}
    <div class="profile-separator"></div>
    <div class="profile-option" id="profile-manage-btn">
      <span class="profile-icon" style="color: var(--text-secondary)">+</span>
      <span class="profile-name">Manage Profiles...</span>
    </div>
  `;

  container.querySelectorAll('.profile-option[data-profile]').forEach((el) => {
    el.addEventListener('click', () => {
      const profileId = el.dataset.profile || null;
      if (onProfileSelect) onProfileSelect(profileId);
      container.classList.remove('open');
    });
  });

  const manageBtn = container.querySelector('#profile-manage-btn');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      container.classList.remove('open');
      openProfileEditor();
    });
  }
}

function openProfileEditor(editProfileId) {
  const modal = document.getElementById('profile-editor-modal');
  if (!modal) return;

  const existing = editProfileId ? getProfile(editProfileId) : null;
  const profile = existing ? { ...existing } : {
    id: 'profile-' + Date.now(),
    name: '',
    shell: '',
    args: [],
    cwd: '',
    env: {},
    themeId: null,
    font: { family: '', size: 14, lineHeight: 1.2 },
    isDefault: false,
  };

  const envEntries = Object.entries(profile.env || {});

  modal.innerHTML = `
    <div class="modal-backdrop" data-close="true"></div>
    <div class="modal-content profile-editor">
      <div class="modal-header">
        <h3>${existing ? 'Edit' : 'New'} Profile</h3>
        <button class="modal-close" data-close="true">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="pe-name" value="${profile.name}" placeholder="My Profile" />
        </div>
        <div class="form-group">
          <label>Shell Path</label>
          <input type="text" id="pe-shell" value="${profile.shell}" placeholder="/bin/bash (leave empty for default)" />
        </div>
        <div class="form-group">
          <label>Arguments (comma-separated)</label>
          <input type="text" id="pe-args" value="${(profile.args || []).join(', ')}" placeholder="--login, -i" />
        </div>
        <div class="form-group">
          <label>Working Directory</label>
          <input type="text" id="pe-cwd" value="${profile.cwd || ''}" placeholder="~ (leave empty for home)" />
        </div>
        <div class="form-section">
          <h4>Font</h4>
          <div class="form-group">
            <label>Family</label>
            <input type="text" id="pe-font-family" value="${profile.font?.family || ''}" placeholder="JetBrains Mono (leave empty for default)" />
          </div>
          <div style="display: flex; gap: 12px;">
            <div class="form-group" style="flex: 1;">
              <label>Size</label>
              <input type="number" id="pe-font-size" value="${profile.font?.size || 14}" min="8" max="32" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label>Line Height</label>
              <input type="number" id="pe-line-height" value="${profile.font?.lineHeight || 1.2}" min="1" max="2" step="0.1" />
            </div>
          </div>
        </div>
        <div class="form-section">
          <h4>Environment Variables</h4>
          <div id="pe-env-list">
            ${envEntries.map(([k, v]) => `
              <div class="env-row">
                <input type="text" class="env-key" value="${k}" placeholder="KEY" />
                <input type="text" class="env-val" value="${v}" placeholder="value" />
                <button class="env-remove">&times;</button>
              </div>
            `).join('')}
          </div>
          <button class="btn-add-env" id="pe-add-env">+ Add Variable</button>
        </div>
        <div class="form-group" style="margin-top: 12px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="pe-default" ${profile.isDefault ? 'checked' : ''} />
            Set as default profile
          </label>
        </div>
      </div>
      <div class="modal-footer">
        ${existing ? '<button class="btn btn-secondary" id="pe-delete" style="margin-right: auto; color: var(--close-hover);">Delete</button>' : ''}
        <button class="btn btn-secondary" data-close="true">Cancel</button>
        <button class="btn btn-primary" id="pe-save">Save</button>
      </div>
    </div>
  `;

  modal.classList.add('open');

  // Add env row
  modal.querySelector('#pe-add-env').addEventListener('click', () => {
    const list = modal.querySelector('#pe-env-list');
    const row = document.createElement('div');
    row.className = 'env-row';
    row.innerHTML = `
      <input type="text" class="env-key" placeholder="KEY" />
      <input type="text" class="env-val" placeholder="value" />
      <button class="env-remove">&times;</button>
    `;
    list.appendChild(row);
    row.querySelector('.env-remove').addEventListener('click', () => row.remove());
  });

  // Existing remove buttons
  modal.querySelectorAll('.env-remove').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.env-row').remove());
  });

  // Close handlers
  modal.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => modal.classList.remove('open'));
  });

  // Delete
  const deleteBtn = modal.querySelector('#pe-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (window.profileAPI) await window.profileAPI.delete(profile.id);
      profiles = profiles.filter((p) => p.id !== profile.id);
      modal.classList.remove('open');
    });
  }

  // Save
  modal.querySelector('#pe-save').addEventListener('click', async () => {
    profile.name = modal.querySelector('#pe-name').value || 'Untitled Profile';
    profile.shell = modal.querySelector('#pe-shell').value || '';
    profile.args = modal.querySelector('#pe-args').value.split(',').map((s) => s.trim()).filter(Boolean);
    profile.cwd = modal.querySelector('#pe-cwd').value || '';
    profile.isDefault = modal.querySelector('#pe-default').checked;
    profile.font = {
      family: modal.querySelector('#pe-font-family').value || '',
      size: parseInt(modal.querySelector('#pe-font-size').value) || 14,
      lineHeight: parseFloat(modal.querySelector('#pe-line-height').value) || 1.2,
    };

    // Collect env vars
    profile.env = {};
    modal.querySelectorAll('.env-row').forEach((row) => {
      const key = row.querySelector('.env-key').value.trim();
      const val = row.querySelector('.env-val').value;
      if (key) profile.env[key] = val;
    });

    if (window.profileAPI) await window.profileAPI.save(profile);

    // Update local cache
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) profiles[idx] = profile;
    else profiles.push(profile);

    // Handle default toggle
    if (profile.isDefault && window.profileAPI) {
      await window.profileAPI.setDefault(profile.id);
      profiles.forEach((p) => { p.isDefault = p.id === profile.id; });
    }

    modal.classList.remove('open');
  });
}

module.exports = {
  loadProfiles,
  getProfiles,
  getProfile,
  getDefaultProfile,
  showProfileSelector,
  openProfileEditor,
  setOnProfileSelect,
};
