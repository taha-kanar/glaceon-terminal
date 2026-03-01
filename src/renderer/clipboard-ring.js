// ── Clipboard Ring (F6) ──
// Keeps last 10 clipboard entries, Ctrl+Alt+V to paste from ring

const MAX_ENTRIES = 10;
const ring = []; // { text, timestamp }
let popupEl = null;
let selectedIndex = 0;
let isOpen = false;
let onPasteFn = null;
let clipboardPollInterval = null;
let lastClipboardText = '';

function init(opts) {
  onPasteFn = opts.onPaste;

  popupEl = document.getElementById('clipboard-ring-popup');
  if (!popupEl) {
    popupEl = document.createElement('div');
    popupEl.id = 'clipboard-ring-popup';
    document.body.appendChild(popupEl);
  }
}

function push(text) {
  if (!text || !text.trim()) return;
  // Remove duplicate if exists
  const idx = ring.findIndex((e) => e.text === text);
  if (idx >= 0) ring.splice(idx, 1);
  ring.unshift({ text, timestamp: Date.now() });
  if (ring.length > MAX_ENTRIES) ring.pop();
  lastClipboardText = text;
}

function openPopup() {
  if (ring.length === 0) return;
  isOpen = true;
  selectedIndex = 0;
  render();
  popupEl.style.display = 'block';

  // Keyboard handler
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('mousedown', onClickOutside, true);
}

function closePopup() {
  isOpen = false;
  popupEl.style.display = 'none';
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('mousedown', onClickOutside, true);
}

function render() {
  popupEl.innerHTML = `
    <div class="cr-header">Clipboard Ring</div>
    <div class="cr-list">
      ${ring.map((entry, i) => `
        <div class="cr-item ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
          <span class="cr-text">${escapeHtml(entry.text.substring(0, 80))}${entry.text.length > 80 ? '...' : ''}</span>
          <span class="cr-time">${formatAge(entry.timestamp)}</span>
        </div>
      `).join('')}
    </div>
    <div class="cr-hint">↑↓ Navigate · Enter Paste · Esc Close</div>
  `;

  // Click handlers
  popupEl.querySelectorAll('.cr-item').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      pasteEntry(idx);
    });
    el.addEventListener('mouseenter', () => {
      selectedIndex = parseInt(el.dataset.index);
      updateSelection();
    });
  });
}

function updateSelection() {
  const items = popupEl.querySelectorAll('.cr-item');
  items.forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
  });
  // Scroll selected into view
  const selected = popupEl.querySelector('.cr-item.selected');
  if (selected) selected.scrollIntoView({ block: 'nearest' });
}

function pasteEntry(index) {
  const entry = ring[index];
  if (entry && onPasteFn) {
    onPasteFn(entry.text);
  }
  closePopup();
}

function onKeyDown(e) {
  if (!isOpen) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closePopup();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    selectedIndex = Math.min(selectedIndex + 1, ring.length - 1);
    updateSelection();
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    updateSelection();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    pasteEntry(selectedIndex);
    return;
  }
}

function onClickOutside(e) {
  if (!popupEl.contains(e.target)) {
    closePopup();
  }
}

function startClipboardPolling() {
  clipboardPollInterval = setInterval(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text !== lastClipboardText) {
        push(text);
      }
    } catch (e) {
      // clipboard read may fail without focus
    }
  }, 1500);
}

function stopClipboardPolling() {
  if (clipboardPollInterval) {
    clearInterval(clipboardPollInterval);
    clipboardPollInterval = null;
  }
}

function formatAge(timestamp) {
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 60) return 'now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  init,
  push,
  openPopup,
  closePopup,
  startClipboardPolling,
  stopClipboardPolling,
};
