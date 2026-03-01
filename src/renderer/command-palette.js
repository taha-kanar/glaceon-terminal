// ── Command Palette ──
// Fuzzy-search action launcher (Ctrl+Shift+P)

const actions = [];
let paletteEl = null;
let inputEl = null;
let listEl = null;
let selectedIndex = 0;
let filteredActions = [];
let isOpen = false;

function registerAction(action) {
  // action: { id, label, category, shortcut?, handler, when? }
  const existing = actions.findIndex((a) => a.id === action.id);
  if (existing >= 0) actions[existing] = action;
  else actions.push(action);
}

function registerActions(actionList) {
  actionList.forEach(registerAction);
}

function unregisterAction(id) {
  const idx = actions.findIndex((a) => a.id === id);
  if (idx >= 0) actions.splice(idx, 1);
}

function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;

  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      score += 10;
      if (lastMatchIndex === ti - 1) {
        consecutive++;
        score += consecutive * 5;
      } else {
        consecutive = 0;
      }
      // Bonus for match at word boundary
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === ':') {
        score += 8;
      }
      lastMatchIndex = ti;
    }
  }

  return qi === q.length ? score : 0;
}

function filterActions(query) {
  if (!query) {
    return actions
      .filter((a) => !a.when || a.when())
      .map((a) => ({ ...a, score: 1 }));
  }

  return actions
    .filter((a) => !a.when || a.when())
    .map((a) => {
      const labelScore = fuzzyScore(query, a.label);
      const catScore = fuzzyScore(query, a.category || '') * 0.5;
      return { ...a, score: Math.max(labelScore, catScore) };
    })
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score);
}

function highlightMatch(text, query) {
  if (!query) return text;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let result = '';

  for (let i = 0; i < text.length; i++) {
    if (qi < q.length && t[i] === q[qi]) {
      result += `<b>${text[i]}</b>`;
      qi++;
    } else {
      result += text[i];
    }
  }
  return result;
}

function renderList(query) {
  filteredActions = filterActions(query);
  selectedIndex = 0;

  const max = 15;
  const visible = filteredActions.slice(0, max);

  if (visible.length === 0) {
    listEl.innerHTML = '<div class="cp-empty">No matching commands</div>';
    return;
  }

  listEl.innerHTML = visible.map((a, i) => `
    <div class="cp-item ${i === 0 ? 'selected' : ''}" data-index="${i}">
      <span class="cp-category">${a.category || 'General'}</span>
      <span class="cp-label">${highlightMatch(a.label, query)}</span>
      ${a.shortcut ? `<span class="cp-shortcut">${a.shortcut}</span>` : ''}
    </div>
  `).join('');
}

function updateSelection() {
  const items = listEl.querySelectorAll('.cp-item');
  items.forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
  });

  const selected = items[selectedIndex];
  if (selected) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

function executeSelected() {
  if (filteredActions.length === 0) return;
  const action = filteredActions[selectedIndex];
  if (action && action.handler) {
    closePalette();
    action.handler();
  }
}

function openPalette() {
  if (isOpen) return;
  isOpen = true;

  paletteEl = document.getElementById('command-palette');
  if (!paletteEl) return;

  paletteEl.innerHTML = `
    <div class="cp-backdrop"></div>
    <div class="cp-container">
      <div class="cp-input-wrapper">
        <svg class="cp-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <input type="text" class="cp-input" placeholder="Type a command..." autocomplete="off" spellcheck="false" />
      </div>
      <div class="cp-list"></div>
    </div>
  `;

  inputEl = paletteEl.querySelector('.cp-input');
  listEl = paletteEl.querySelector('.cp-list');

  paletteEl.classList.add('open');
  renderList('');
  inputEl.focus();

  inputEl.addEventListener('input', () => {
    renderList(inputEl.value.trim());
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selectedIndex < filteredActions.length - 1) {
        selectedIndex++;
        updateSelection();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedIndex > 0) {
        selectedIndex--;
        updateSelection();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });

  // Click on item
  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.cp-item');
    if (item) {
      selectedIndex = parseInt(item.dataset.index);
      executeSelected();
    }
  });

  // Click backdrop to close
  paletteEl.querySelector('.cp-backdrop').addEventListener('click', () => {
    closePalette();
  });
}

function closePalette() {
  if (!isOpen) return;
  isOpen = false;
  if (paletteEl) {
    paletteEl.classList.remove('open');
    paletteEl.innerHTML = '';
  }
}

function togglePalette() {
  if (isOpen) closePalette();
  else openPalette();
}

module.exports = {
  registerAction,
  registerActions,
  unregisterAction,
  openPalette,
  closePalette,
  togglePalette,
};
