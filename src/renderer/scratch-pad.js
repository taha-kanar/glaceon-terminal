// ── Terminal Scratch Pad ──
// Collapsible notes textarea at the bottom of each tab

const scratchPads = new Map(); // tabId -> { text, collapsed }
let onContentChangeFn = null;

function init(opts) {
  onContentChangeFn = opts.onContentChange || null;
}

function createForTab(tabId, wrapperEl) {
  if (scratchPads.has(tabId)) return;

  const data = { text: '', collapsed: true };
  scratchPads.set(tabId, data);

  const container = document.createElement('div');
  container.className = 'scratch-pad collapsed';
  container.dataset.tabId = tabId;

  container.innerHTML = `
    <div class="scratch-pad-header">
      <span class="scratch-pad-toggle-icon">&#9654;</span>
      <span class="scratch-pad-label">Scratch Pad</span>
      <span class="scratch-pad-chars">0 chars</span>
    </div>
    <div class="scratch-pad-body">
      <textarea class="scratch-pad-textarea" placeholder="Jot down commands, IPs, tokens..." spellcheck="false"></textarea>
    </div>
  `;

  wrapperEl.appendChild(container);

  // Toggle collapse
  const header = container.querySelector('.scratch-pad-header');
  header.addEventListener('click', () => {
    toggleInternal(tabId, container, data);
  });

  // Input events
  const textarea = container.querySelector('.scratch-pad-textarea');
  textarea.addEventListener('input', () => {
    data.text = textarea.value;
    const charsEl = container.querySelector('.scratch-pad-chars');
    if (charsEl) charsEl.textContent = `${data.text.length} chars`;
    if (onContentChangeFn) onContentChangeFn();
  });

  // Prevent terminal from stealing focus when typing in scratch pad
  textarea.addEventListener('keydown', (e) => {
    e.stopPropagation();
  });
}

function toggleInternal(tabId, container, data) {
  data.collapsed = !data.collapsed;
  if (data.collapsed) {
    container.classList.add('collapsed');
    container.querySelector('.scratch-pad-toggle-icon').innerHTML = '&#9654;';
  } else {
    container.classList.remove('collapsed');
    container.querySelector('.scratch-pad-toggle-icon').innerHTML = '&#9660;';
    // Focus textarea
    const textarea = container.querySelector('.scratch-pad-textarea');
    if (textarea) setTimeout(() => textarea.focus(), 50);
  }
  // Dispatch resize event so panes refit
  container.closest('.terminal-wrapper')?.dispatchEvent(
    new CustomEvent('scratch-pad-resize', { bubbles: false })
  );
}

function toggle(tabId) {
  const data = scratchPads.get(tabId);
  if (!data) return;
  const container = document.querySelector(`.scratch-pad[data-tab-id="${tabId}"]`);
  if (!container) return;
  toggleInternal(tabId, container, data);
}

function restoreForTab(tabId, savedData) {
  if (!savedData) return;
  const data = scratchPads.get(tabId);
  if (!data) return;

  data.text = savedData.text || '';
  data.collapsed = savedData.collapsed !== false; // default collapsed

  const container = document.querySelector(`.scratch-pad[data-tab-id="${tabId}"]`);
  if (!container) return;

  const textarea = container.querySelector('.scratch-pad-textarea');
  if (textarea) textarea.value = data.text;

  const charsEl = container.querySelector('.scratch-pad-chars');
  if (charsEl) charsEl.textContent = `${data.text.length} chars`;

  if (!data.collapsed) {
    container.classList.remove('collapsed');
    container.querySelector('.scratch-pad-toggle-icon').innerHTML = '&#9660;';
  }
}

function removeForTab(tabId) {
  scratchPads.delete(tabId);
  const container = document.querySelector(`.scratch-pad[data-tab-id="${tabId}"]`);
  if (container) container.remove();
}

function getForTab(tabId) {
  const data = scratchPads.get(tabId);
  if (!data) return null;
  return { text: data.text, collapsed: data.collapsed };
}

module.exports = {
  init,
  createForTab,
  restoreForTab,
  removeForTab,
  getForTab,
  toggle,
};
