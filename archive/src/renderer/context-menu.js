const TAB_COLORS = [
  { name: 'Red', color: '#f7768e' },
  { name: 'Orange', color: '#ff9e64' },
  { name: 'Yellow', color: '#e0af68' },
  { name: 'Green', color: '#9ece6a' },
  { name: 'Cyan', color: '#7dcfff' },
  { name: 'Blue', color: '#7aa2f7' },
  { name: 'Purple', color: '#bb9af7' },
  { name: 'None', color: '' },
];

let currentCleanup = null;

function showContextMenu(x, y, items) {
  const menu = document.getElementById('context-menu');
  if (!menu) return;

  // Cancel any previous invocation — resolve its promise with null, remove its listeners
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  menu.innerHTML = items.map((item) => {
    if (item.separator) return '<div class="ctx-separator"></div>';
    if (item.colors) {
      return `
        <div class="ctx-color-row">
          ${TAB_COLORS.map((c) => `
            <div class="ctx-color-swatch ${item.activeColor === c.color ? 'active' : ''}"
                 style="background: ${c.color || 'var(--glass-border)'}"
                 data-color="${c.color}" title="${c.name}"></div>
          `).join('')}
        </div>
      `;
    }
    return `
      <div class="ctx-item" data-action="${item.action}"${item.groupId ? ` data-group-id="${item.groupId}"` : ''}${item.color ? ` data-color="${item.color}"` : ''}>
        <span>${item.label}</span>
        ${item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : ''}
      </div>
    `;
  }).join('');

  // Position
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('open');

  // Ensure menu fits on screen
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    }
  });

  return new Promise((resolve) => {
    let cleaned = false;

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      menu.classList.remove('open');
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleDismiss);
      if (currentCleanup === cleanup) currentCleanup = null;
    }

    function handleClick(e) {
      const actionEl = e.target.closest('.ctx-item');
      const colorEl = e.target.closest('.ctx-color-swatch');

      if (actionEl) {
        const result = { action: actionEl.dataset.action };
        if (actionEl.dataset.groupId) result.groupId = actionEl.dataset.groupId;
        if (actionEl.dataset.color) result.color = actionEl.dataset.color;
        cleanup();
        resolve(result);
      } else if (colorEl) {
        cleanup();
        resolve({ action: 'color', color: colorEl.dataset.color });
      } else if (!e.target.closest('#context-menu')) {
        cleanup();
        resolve(null);
      }
      // click inside menu but not on an item — do nothing
    }

    function handleDismiss(e) {
      e.preventDefault();
      if (!e.target.closest('#context-menu')) {
        cleanup();
        resolve(null);
      }
      // Right-click inside menu — preventDefault stops the native context menu
    }

    // Store cleanup so future invocations (or hideContextMenu) can cancel this one
    currentCleanup = () => {
      cleanup();
      resolve(null);
    };

    // Register listeners synchronously — no setTimeout gap
    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleDismiss);
  });
}

function hideContextMenu() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
}

module.exports = { showContextMenu, hideContextMenu, TAB_COLORS };
