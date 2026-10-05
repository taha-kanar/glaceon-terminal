const builtInThemes = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    type: 'built-in',
    colors: {
      glassBg: 'rgba(15, 15, 25, 0.72)',
      glassTitlebar: 'rgba(10, 10, 20, 0.65)',
      glassTabbar: 'rgba(10, 10, 20, 0.55)',
      glassTab: 'rgba(255, 255, 255, 0.04)',
      glassTabActive: 'rgba(255, 255, 255, 0.08)',
      glassTabHover: 'rgba(122, 162, 247, 0.1)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderStrong: 'rgba(255, 255, 255, 0.12)',
      glassGlow: 'rgba(122, 162, 247, 0.15)',
      textPrimary: '#c0caf5',
      textSecondary: 'rgba(165, 175, 215, 0.6)',
      accent: '#7aa2f7',
      accentGlow: 'rgba(122, 162, 247, 0.4)',
      closeHover: '#f7768e',
      accentRgb: '122, 162, 247',
      colorSuccess: '#9ece6a',
      colorWarning: '#e0af68',
      colorError: '#f7768e',
      terminal: {
        foreground: '#c0caf5',
        cursor: '#7aa2f7',
        cursorAccent: '#1a1b26',
        selectionBackground: 'rgba(51, 70, 124, 0.5)',
        selectionForeground: '#c0caf5',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
    },
    glass: { opacity: 0.72, blur: 40, saturation: 1.4 },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    type: 'built-in',
    colors: {
      glassBg: 'rgba(30, 30, 46, 0.72)',
      glassTitlebar: 'rgba(24, 24, 37, 0.65)',
      glassTabbar: 'rgba(24, 24, 37, 0.55)',
      glassTab: 'rgba(255, 255, 255, 0.04)',
      glassTabActive: 'rgba(255, 255, 255, 0.08)',
      glassTabHover: 'rgba(137, 180, 250, 0.1)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderStrong: 'rgba(255, 255, 255, 0.12)',
      glassGlow: 'rgba(137, 180, 250, 0.15)',
      textPrimary: '#cdd6f4',
      textSecondary: 'rgba(166, 173, 200, 0.6)',
      accent: '#89b4fa',
      accentGlow: 'rgba(137, 180, 250, 0.4)',
      closeHover: '#f38ba8',
      accentRgb: '137, 180, 250',
      colorSuccess: '#a6e3a1',
      colorWarning: '#f9e2af',
      colorError: '#f38ba8',
      terminal: {
        foreground: '#cdd6f4',
        cursor: '#89b4fa',
        cursorAccent: '#1e1e2e',
        selectionBackground: 'rgba(88, 91, 112, 0.5)',
        selectionForeground: '#cdd6f4',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
    },
    glass: { opacity: 0.72, blur: 40, saturation: 1.4 },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'built-in',
    colors: {
      glassBg: 'rgba(40, 42, 54, 0.72)',
      glassTitlebar: 'rgba(33, 34, 44, 0.65)',
      glassTabbar: 'rgba(33, 34, 44, 0.55)',
      glassTab: 'rgba(255, 255, 255, 0.04)',
      glassTabActive: 'rgba(255, 255, 255, 0.08)',
      glassTabHover: 'rgba(189, 147, 249, 0.1)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderStrong: 'rgba(255, 255, 255, 0.12)',
      glassGlow: 'rgba(189, 147, 249, 0.15)',
      textPrimary: '#f8f8f2',
      textSecondary: 'rgba(189, 183, 207, 0.6)',
      accent: '#bd93f9',
      accentGlow: 'rgba(189, 147, 249, 0.4)',
      closeHover: '#ff5555',
      accentRgb: '189, 147, 249',
      colorSuccess: '#50fa7b',
      colorWarning: '#f1fa8c',
      colorError: '#ff5555',
      terminal: {
        foreground: '#f8f8f2',
        cursor: '#bd93f9',
        cursorAccent: '#282a36',
        selectionBackground: 'rgba(68, 71, 90, 0.5)',
        selectionForeground: '#f8f8f2',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#bd93f9',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
    },
    glass: { opacity: 0.72, blur: 40, saturation: 1.4 },
  },
  {
    id: 'nord',
    name: 'Nord',
    type: 'built-in',
    colors: {
      glassBg: 'rgba(46, 52, 64, 0.72)',
      glassTitlebar: 'rgba(36, 40, 50, 0.65)',
      glassTabbar: 'rgba(36, 40, 50, 0.55)',
      glassTab: 'rgba(255, 255, 255, 0.04)',
      glassTabActive: 'rgba(255, 255, 255, 0.08)',
      glassTabHover: 'rgba(136, 192, 208, 0.1)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderStrong: 'rgba(255, 255, 255, 0.12)',
      glassGlow: 'rgba(136, 192, 208, 0.15)',
      textPrimary: '#d8dee9',
      textSecondary: 'rgba(176, 183, 196, 0.6)',
      accent: '#88c0d0',
      accentGlow: 'rgba(136, 192, 208, 0.4)',
      closeHover: '#bf616a',
      accentRgb: '136, 192, 208',
      colorSuccess: '#a3be8c',
      colorWarning: '#ebcb8b',
      colorError: '#bf616a',
      terminal: {
        foreground: '#d8dee9',
        cursor: '#88c0d0',
        cursorAccent: '#2e3440',
        selectionBackground: 'rgba(67, 76, 94, 0.5)',
        selectionForeground: '#d8dee9',
        black: '#3b4252',
        red: '#bf616a',
        green: '#a3be8c',
        yellow: '#ebcb8b',
        blue: '#81a1c1',
        magenta: '#b48ead',
        cyan: '#88c0d0',
        white: '#e5e9f0',
        brightBlack: '#4c566a',
        brightRed: '#bf616a',
        brightGreen: '#a3be8c',
        brightYellow: '#ebcb8b',
        brightBlue: '#81a1c1',
        brightMagenta: '#b48ead',
        brightCyan: '#8fbcbb',
        brightWhite: '#eceff4',
      },
    },
    glass: { opacity: 0.72, blur: 40, saturation: 1.3 },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    type: 'built-in',
    colors: {
      glassBg: 'rgba(40, 40, 40, 0.72)',
      glassTitlebar: 'rgba(30, 30, 30, 0.65)',
      glassTabbar: 'rgba(30, 30, 30, 0.55)',
      glassTab: 'rgba(255, 255, 255, 0.04)',
      glassTabActive: 'rgba(255, 255, 255, 0.08)',
      glassTabHover: 'rgba(215, 153, 33, 0.1)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderStrong: 'rgba(255, 255, 255, 0.12)',
      glassGlow: 'rgba(215, 153, 33, 0.15)',
      textPrimary: '#ebdbb2',
      textSecondary: 'rgba(189, 174, 147, 0.6)',
      accent: '#d79921',
      accentGlow: 'rgba(215, 153, 33, 0.4)',
      closeHover: '#fb4934',
      accentRgb: '215, 153, 33',
      colorSuccess: '#98971a',
      colorWarning: '#d79921',
      colorError: '#cc241d',
      terminal: {
        foreground: '#ebdbb2',
        cursor: '#d79921',
        cursorAccent: '#282828',
        selectionBackground: 'rgba(80, 73, 69, 0.5)',
        selectionForeground: '#ebdbb2',
        black: '#282828',
        red: '#cc241d',
        green: '#98971a',
        yellow: '#d79921',
        blue: '#458588',
        magenta: '#b16286',
        cyan: '#689d6a',
        white: '#a89984',
        brightBlack: '#928374',
        brightRed: '#fb4934',
        brightGreen: '#b8bb26',
        brightYellow: '#fabd2f',
        brightBlue: '#83a598',
        brightMagenta: '#d3869b',
        brightCyan: '#8ec07c',
        brightWhite: '#ebdbb2',
      },
    },
    glass: { opacity: 0.72, blur: 40, saturation: 1.3 },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    type: 'built-in',
    colors: {
      glassBg: 'rgba(40, 44, 52, 0.72)',
      glassTitlebar: 'rgba(33, 37, 43, 0.65)',
      glassTabbar: 'rgba(33, 37, 43, 0.55)',
      glassTab: 'rgba(255, 255, 255, 0.04)',
      glassTabActive: 'rgba(255, 255, 255, 0.08)',
      glassTabHover: 'rgba(97, 175, 239, 0.1)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderStrong: 'rgba(255, 255, 255, 0.12)',
      glassGlow: 'rgba(97, 175, 239, 0.15)',
      textPrimary: '#abb2bf',
      textSecondary: 'rgba(139, 145, 157, 0.6)',
      accent: '#61afef',
      accentGlow: 'rgba(97, 175, 239, 0.4)',
      closeHover: '#e06c75',
      accentRgb: '97, 175, 239',
      colorSuccess: '#98c379',
      colorWarning: '#e5c07b',
      colorError: '#e06c75',
      terminal: {
        foreground: '#abb2bf',
        cursor: '#61afef',
        cursorAccent: '#282c34',
        selectionBackground: 'rgba(62, 68, 81, 0.5)',
        selectionForeground: '#abb2bf',
        black: '#282c34',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
    },
    glass: { opacity: 0.72, blur: 40, saturation: 1.4 },
  },
];

let allTerminals = []; // will be set by renderer
let currentThemeId = 'tokyo-night';
let customThemes = [];

function getAllThemes() {
  return [...builtInThemes, ...customThemes];
}

function getTheme(id) {
  return getAllThemes().find((t) => t.id === id);
}

function applyTheme(id) {
  const theme = getTheme(id);
  if (!theme) return;
  currentThemeId = id;

  const root = document.documentElement;
  const c = theme.colors;

  // CSS custom properties
  root.style.setProperty('--glass-bg', c.glassBg);
  root.style.setProperty('--glass-titlebar', c.glassTitlebar);
  root.style.setProperty('--glass-tabbar', c.glassTabbar);
  root.style.setProperty('--glass-tab', c.glassTab);
  root.style.setProperty('--glass-tab-active', c.glassTabActive);
  root.style.setProperty('--glass-tab-hover', c.glassTabHover);
  root.style.setProperty('--glass-border', c.glassBorder);
  root.style.setProperty('--glass-border-strong', c.glassBorderStrong);
  root.style.setProperty('--glass-glow', c.glassGlow);
  root.style.setProperty('--text-primary', c.textPrimary);
  root.style.setProperty('--text-secondary', c.textSecondary);
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--accent-glow', c.accentGlow);
  root.style.setProperty('--close-hover', c.closeHover);
  root.style.setProperty('--accent-rgb', c.accentRgb || '122, 162, 247');
  root.style.setProperty('--color-success', c.colorSuccess || '#9ece6a');
  root.style.setProperty('--color-warning', c.colorWarning || '#e0af68');
  root.style.setProperty('--color-error', c.colorError || '#f7768e');

  // Glass properties
  const g = theme.glass;
  root.style.setProperty('--glass-blur', g.blur + 'px');
  root.style.setProperty('--glass-saturation', String(g.saturation));
  root.style.setProperty('--glass-opacity', String(g.opacity));

  // Update all xterm instances
  const xtermTheme = { background: 'rgba(0, 0, 0, 0)', ...c.terminal };
  allTerminals.forEach((entry) => {
    if (entry.term) entry.term.options.theme = xtermTheme;
  });

  // Save preference
  if (window.settingsAPI) {
    window.settingsAPI.set('activeThemeId', id);
    // Re-apply saved opacity on top of new theme
    window.settingsAPI.get('settings').then((s) => {
      if (s && s.terminalOpacity != null && s.terminalOpacity !== 0.72) {
        applyOpacity(s.terminalOpacity);
      }
    });
  }
}

function getTerminalTheme(themeId) {
  const theme = getTheme(themeId || currentThemeId);
  if (!theme) return {};
  return { background: 'rgba(0, 0, 0, 0)', ...theme.colors.terminal };
}

function setTerminalsList(list) {
  allTerminals = list;
}

function getCurrentThemeId() {
  return currentThemeId;
}

// Theme editor modal
function openThemeEditor(baseThemeId) {
  let modal = document.getElementById('theme-editor-modal');
  if (!modal) return;

  const base = getTheme(baseThemeId || currentThemeId);
  if (!base) return;

  const editTheme = JSON.parse(JSON.stringify(base));
  if (base.type === 'built-in') {
    editTheme.id = 'custom-' + Date.now();
    editTheme.name = base.name + ' (Custom)';
    editTheme.type = 'custom';
  }

  modal.innerHTML = `
    <div class="modal-backdrop" data-close="true"></div>
    <div class="modal-content theme-editor">
      <div class="modal-header">
        <h3>Theme Editor</h3>
        <button class="modal-close" data-close="true">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Theme Name</label>
          <input type="text" id="te-name" value="${editTheme.name}" />
        </div>
        <div class="form-section">
          <h4>Glass Effect</h4>
          <div class="slider-group">
            <label>Opacity: <span id="te-opacity-val">${editTheme.glass.opacity}</span></label>
            <input type="range" id="te-opacity" min="0.1" max="1" step="0.01" value="${editTheme.glass.opacity}" />
          </div>
          <div class="slider-group">
            <label>Blur: <span id="te-blur-val">${editTheme.glass.blur}px</span></label>
            <input type="range" id="te-blur" min="0" max="100" step="1" value="${editTheme.glass.blur}" />
          </div>
          <div class="slider-group">
            <label>Saturation: <span id="te-sat-val">${editTheme.glass.saturation}</span></label>
            <input type="range" id="te-saturation" min="0.5" max="3" step="0.1" value="${editTheme.glass.saturation}" />
          </div>
        </div>
        <div class="form-section">
          <h4>UI Colors</h4>
          <div class="color-grid">
            <div class="color-item">
              <label>Accent</label>
              <input type="color" id="te-accent" value="${editTheme.colors.accent}" />
            </div>
            <div class="color-item">
              <label>Text</label>
              <input type="color" id="te-text" value="${editTheme.colors.textPrimary}" />
            </div>
            <div class="color-item">
              <label>Close</label>
              <input type="color" id="te-close" value="${editTheme.colors.closeHover}" />
            </div>
          </div>
        </div>
        <div class="form-section">
          <h4>Terminal Colors</h4>
          <div class="color-grid">
            ${['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'].map((c) => `
              <div class="color-item">
                <label>${c}</label>
                <input type="color" id="te-term-${c}" value="${editTheme.colors.terminal[c]}" />
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-close="true">Cancel</button>
        <button class="btn btn-primary" id="te-save">Save Theme</button>
      </div>
    </div>
  `;

  modal.classList.add('open');

  // Slider live preview
  const opacitySlider = modal.querySelector('#te-opacity');
  const blurSlider = modal.querySelector('#te-blur');
  const satSlider = modal.querySelector('#te-saturation');

  opacitySlider.addEventListener('input', () => {
    modal.querySelector('#te-opacity-val').textContent = opacitySlider.value;
    editTheme.glass.opacity = parseFloat(opacitySlider.value);
    previewGlass(editTheme.glass);
  });
  blurSlider.addEventListener('input', () => {
    modal.querySelector('#te-blur-val').textContent = blurSlider.value + 'px';
    editTheme.glass.blur = parseInt(blurSlider.value);
    previewGlass(editTheme.glass);
  });
  satSlider.addEventListener('input', () => {
    modal.querySelector('#te-sat-val').textContent = satSlider.value;
    editTheme.glass.saturation = parseFloat(satSlider.value);
    previewGlass(editTheme.glass);
  });

  // Close handlers
  modal.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => {
      modal.classList.remove('open');
      applyTheme(currentThemeId); // revert preview
    });
  });

  // Save
  modal.querySelector('#te-save').addEventListener('click', async () => {
    editTheme.name = modal.querySelector('#te-name').value || 'Custom Theme';
    editTheme.colors.accent = modal.querySelector('#te-accent').value;
    editTheme.colors.textPrimary = modal.querySelector('#te-text').value;
    editTheme.colors.closeHover = modal.querySelector('#te-close').value;
    editTheme.colors.terminal.foreground = modal.querySelector('#te-text').value;
    editTheme.colors.terminal.cursor = modal.querySelector('#te-accent').value;

    ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'].forEach((c) => {
      editTheme.colors.terminal[c] = modal.querySelector(`#te-term-${c}`).value;
      editTheme.colors.terminal['bright' + c.charAt(0).toUpperCase() + c.slice(1)] = modal.querySelector(`#te-term-${c}`).value;
    });

    // Recompute derived colors from accent
    const accent = editTheme.colors.accent;
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    editTheme.colors.accentGlow = `rgba(${r}, ${g}, ${b}, 0.4)`;
    editTheme.colors.glassGlow = `rgba(${r}, ${g}, ${b}, 0.15)`;
    editTheme.colors.glassTabHover = `rgba(${r}, ${g}, ${b}, 0.1)`;
    editTheme.colors.textSecondary = `rgba(${r}, ${g}, ${b}, 0.35)`;
    editTheme.colors.accentRgb = `${r}, ${g}, ${b}`;

    // Save via IPC
    if (window.themeAPI) {
      await window.themeAPI.save(editTheme);
    }

    // Update local cache
    const idx = customThemes.findIndex((t) => t.id === editTheme.id);
    if (idx >= 0) customThemes[idx] = editTheme;
    else customThemes.push(editTheme);

    applyTheme(editTheme.id);
    modal.classList.remove('open');
    renderThemePicker();
  });
}

function previewGlass(glass) {
  const root = document.documentElement;
  root.style.setProperty('--glass-blur', glass.blur + 'px');
  root.style.setProperty('--glass-saturation', String(glass.saturation));
  root.style.setProperty('--glass-opacity', String(glass.opacity));
}

// Parse rgba() string into { r, g, b, a }
function parseRgba(str) {
  const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
}

// Apply a global opacity to all glass backgrounds
// opacity: 0.1 (very transparent) to 1.0 (fully opaque / solid)
function applyOpacity(opacity) {
  const theme = getTheme(currentThemeId);
  if (!theme) return;

  const root = document.documentElement;
  const c = theme.colors;

  // Parse the base RGB from each glass color, replace alpha with user's opacity
  const glassPairs = [
    ['--glass-bg', c.glassBg, 1.0],         // main body: full opacity multiplier
    ['--glass-titlebar', c.glassTitlebar, 0.9],  // titlebar: slightly less
    ['--glass-tabbar', c.glassTabbar, 0.8],      // tabbar: slightly less
  ];

  for (const [prop, baseColor, scale] of glassPairs) {
    const parsed = parseRgba(baseColor);
    if (parsed) {
      const newAlpha = Math.min(1, Math.max(0, opacity * scale));
      root.style.setProperty(prop, `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${newAlpha})`);
    }
  }

  root.style.setProperty('--glass-opacity', String(opacity));

  // When fully opaque, disable backdrop-filter (nothing to blur behind solid bg)
  if (opacity >= 1.0) {
    root.style.setProperty('--glass-blur', '0px');
    root.style.setProperty('--glass-saturation', '1');
  } else {
    const g = theme.glass;
    root.style.setProperty('--glass-blur', g.blur + 'px');
    root.style.setProperty('--glass-saturation', String(g.saturation));
  }
}

// Theme picker dropdown — uses event delegation to avoid detached-DOM issues
function renderThemePicker() {
  const container = document.getElementById('theme-picker-menu');
  if (!container) return;

  const themes = getAllThemes();
  container.innerHTML = themes.map((t) => `
    <div class="theme-option ${t.id === currentThemeId ? 'active' : ''}" data-id="${t.id}">
      <span class="theme-dot" style="background: ${t.colors.accent}"></span>
      <span class="theme-name">${t.name}</span>
      ${t.type === 'custom' ? '<button class="theme-delete" data-delete="' + t.id + '">&times;</button>' : ''}
    </div>
  `).join('') + `
    <div class="theme-option theme-option-edit" data-action="edit">
      <span class="theme-dot" style="background: var(--text-secondary)">+</span>
      <span class="theme-name">Custom Theme...</span>
    </div>
  `;
}

function setupThemePickerDelegation() {
  const container = document.getElementById('theme-picker-menu');
  if (!container) return;

  container.addEventListener('click', async (e) => {
    // Delete button
    const deleteBtn = e.target.closest('.theme-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.dataset.delete;
      if (window.themeAPI) await window.themeAPI.delete(id);
      customThemes = customThemes.filter((t) => t.id !== id);
      if (currentThemeId === id) applyTheme('tokyo-night');
      renderThemePicker();
      return;
    }

    // Edit / custom theme button
    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      container.classList.remove('open');
      openThemeEditor(currentThemeId);
      return;
    }

    // Theme selection
    const option = e.target.closest('.theme-option[data-id]');
    if (option) {
      applyTheme(option.dataset.id);
      container.classList.remove('open');
      renderThemePicker();
      return;
    }
  });
}

function toggleThemePicker() {
  const menu = document.getElementById('theme-picker-menu');
  if (!menu) return;
  menu.classList.toggle('open');
  if (menu.classList.contains('open')) renderThemePicker();
}

async function initThemeEngine() {
  // Load custom themes from store
  if (window.themeAPI) {
    const all = await window.themeAPI.getAll();
    customThemes = all.filter((t) => t.type === 'custom');
  }

  // Load saved theme preference
  if (window.settingsAPI) {
    const savedId = await window.settingsAPI.get('activeThemeId');
    if (savedId && getTheme(savedId)) {
      applyTheme(savedId);
    }
  }

  // Wire up theme picker button + delegation (once)
  setupThemePickerDelegation();
  const btn = document.getElementById('btn-theme');
  if (btn) btn.addEventListener('click', toggleThemePicker);

  // Close picker on outside click
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('theme-picker-menu');
    if (menu && menu.classList.contains('open') && !e.target.closest('#btn-theme') && !e.target.closest('#theme-picker-menu')) {
      menu.classList.remove('open');
    }
  });
}

module.exports = {
  builtInThemes,
  getAllThemes,
  getTheme,
  applyTheme,
  applyOpacity,
  getTerminalTheme,
  setTerminalsList,
  getCurrentThemeId,
  initThemeEngine,
  openThemeEditor,
  renderThemePicker,
  toggleThemePicker,
};
