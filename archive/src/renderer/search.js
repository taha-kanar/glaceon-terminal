const { SearchAddon } = require('@xterm/addon-search');

// Map terminalId -> searchAddon
const searchAddons = new Map();
let activeSearchBar = null;

function createSearchAddon(term, terminalId) {
  const addon = new SearchAddon();
  term.loadAddon(addon);
  searchAddons.set(terminalId, addon);
  return addon;
}

function getSearchAddon(terminalId) {
  return searchAddons.get(terminalId);
}

function removeSearchAddon(terminalId) {
  const addon = searchAddons.get(terminalId);
  if (addon) {
    addon.dispose();
    searchAddons.delete(terminalId);
  }
}

function toggleSearchBar(paneWrapper, terminalId) {
  // If already open in this pane, close it
  const existing = paneWrapper.querySelector('.search-bar');
  if (existing) {
    closeSearchBar(terminalId);
    return;
  }

  // Close any other open search bar
  if (activeSearchBar) {
    activeSearchBar.bar.remove();
    activeSearchBar = null;
  }

  const addon = searchAddons.get(terminalId);
  if (!addon) return;

  const bar = document.createElement('div');
  bar.className = 'search-bar';

  let isRegex = false;
  let isCaseSensitive = false;

  bar.innerHTML = `
    <input type="text" class="search-input" placeholder="Find..." />
    <button class="search-btn" id="sb-regex" title="Regex">.*</button>
    <button class="search-btn" id="sb-case" title="Case Sensitive">Aa</button>
    <div class="search-divider"></div>
    <span class="search-count"></span>
    <button class="search-btn" id="sb-prev" title="Previous (Shift+Enter)">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"></polyline></svg>
    </button>
    <button class="search-btn" id="sb-next" title="Next (Enter)">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>
    <div class="search-divider"></div>
    <button class="search-close" id="sb-close" title="Close (Esc)">&times;</button>
  `;

  paneWrapper.style.position = 'relative';
  paneWrapper.appendChild(bar);

  const input = bar.querySelector('.search-input');
  const countEl = bar.querySelector('.search-count');
  const regexBtn = bar.querySelector('#sb-regex');
  const caseBtn = bar.querySelector('#sb-case');
  const prevBtn = bar.querySelector('#sb-prev');
  const nextBtn = bar.querySelector('#sb-next');
  const closeBtn = bar.querySelector('#sb-close');

  function doSearch(direction) {
    const query = input.value;
    if (!query) {
      addon.clearDecorations();
      countEl.textContent = '';
      return;
    }

    const opts = {
      regex: isRegex,
      caseSensitive: isCaseSensitive,
      decorations: {
        matchOverviewRuler: '#888',
        activeMatchColorOverviewRuler: '#fff',
      },
    };

    if (direction === 'prev') {
      addon.findPrevious(query, opts);
    } else {
      addon.findNext(query, opts);
    }
  }

  input.addEventListener('input', () => doSearch('next'));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch(e.shiftKey ? 'prev' : 'next');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchBar(terminalId);
    }
  });

  regexBtn.addEventListener('click', () => {
    isRegex = !isRegex;
    regexBtn.classList.toggle('active', isRegex);
    doSearch('next');
  });

  caseBtn.addEventListener('click', () => {
    isCaseSensitive = !isCaseSensitive;
    caseBtn.classList.toggle('active', isCaseSensitive);
    doSearch('next');
  });

  prevBtn.addEventListener('click', () => doSearch('prev'));
  nextBtn.addEventListener('click', () => doSearch('next'));
  closeBtn.addEventListener('click', () => closeSearchBar(terminalId));

  input.focus();

  activeSearchBar = { bar, terminalId };
}

function closeSearchBar(terminalId) {
  if (activeSearchBar && activeSearchBar.terminalId === terminalId) {
    const addon = searchAddons.get(terminalId);
    if (addon) addon.clearDecorations();
    activeSearchBar.bar.remove();
    activeSearchBar = null;
  }
}

function disposeAllSearch() {
  searchAddons.forEach((addon) => addon.dispose());
  searchAddons.clear();
  if (activeSearchBar) {
    activeSearchBar.bar.remove();
    activeSearchBar = null;
  }
}

module.exports = {
  createSearchAddon,
  getSearchAddon,
  removeSearchAddon,
  toggleSearchBar,
  closeSearchBar,
  disposeAllSearch,
};
