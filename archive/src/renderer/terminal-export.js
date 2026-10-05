// ── Terminal Export ──
// Export terminal buffer as Plain Text, HTML, or ANSI

const path = require('path');
const os = require('os');

async function exportTerminal(term) {
  if (!term) return;

  const format = await showFormatPicker();
  if (!format) return;

  let content = '';
  let defaultExt = '';

  try {
    switch (format) {
      case 'text':
        content = getBufferAsText(term);
        defaultExt = 'txt';
        break;
      case 'html':
        content = getBufferAsHTML(term);
        defaultExt = 'html';
        break;
      case 'ansi':
        content = getBufferAsText(term);
        defaultExt = 'ans';
        break;
    }
  } catch (e) {
    console.error('Export: failed to read buffer', e);
    return;
  }

  if (!content) return;

  // Use custom in-app file path prompt (avoids broken GTK native dialog on Linux)
  const defaultPath = path.join(os.homedir(), `terminal-export.${defaultExt}`);
  const filePath = await showSavePrompt(defaultPath);

  if (filePath && window.fileAPI) {
    try {
      const ok = await window.fileAPI.write(filePath, content);
      if (ok) {
        showToast(`Exported to ${filePath}`);
      } else {
        showToast('Export failed — could not write file');
      }
    } catch (e) {
      console.error('Export: write error', e);
      showToast('Export failed');
    }
  }
}

function getBufferAsText(term) {
  const buffer = term.buffer.active;
  const lines = [];

  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) lines.push(line.translateToString(true));
  }

  // Trim trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

function getBufferAsHTML(term) {
  const buffer = term.buffer.active;
  const lines = [];

  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;

    let lineHtml = '';
    for (let j = 0; j < line.length; j++) {
      const cell = line.getCell(j);
      if (!cell) continue;

      const char = cell.getChars();
      if (!char) continue;

      const escaped = escapeHtml(char);
      let styles = [];

      try {
        const fgMode = cell.getFgColorMode();
        const bgMode = cell.getBgColorMode();

        if (fgMode === 1) {
          styles.push(`color: ${ansiColor(cell.getFgColor())}`);
        } else if (fgMode === 2) {
          const fg = cell.getFgColor();
          styles.push(`color: rgb(${(fg >> 16) & 0xff},${(fg >> 8) & 0xff},${fg & 0xff})`);
        }

        if (bgMode === 1) {
          styles.push(`background: ${ansiColor(cell.getBgColor())}`);
        } else if (bgMode === 2) {
          const bg = cell.getBgColor();
          styles.push(`background: rgb(${(bg >> 16) & 0xff},${(bg >> 8) & 0xff},${bg & 0xff})`);
        }

        if (cell.isBold()) styles.push('font-weight: bold');
        if (cell.isItalic()) styles.push('font-style: italic');
        if (cell.isUnderline()) styles.push('text-decoration: underline');
      } catch (e) {
        // cell API may vary by xterm version
      }

      if (styles.length > 0) {
        lineHtml += `<span style="${styles.join(';')}">${escaped}</span>`;
      } else {
        lineHtml += escaped;
      }
    }

    lines.push(lineHtml);
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Terminal Export</title>
  <style>
    body {
      background: #1a1b26;
      color: #c0caf5;
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 14px;
      line-height: 1.2;
      padding: 16px;
      white-space: pre;
    }
  </style>
</head>
<body>${lines.join('\n')}</body>
</html>`;
}

const ANSI_COLORS = [
  '#000000', '#cc0000', '#4e9a06', '#c4a000',
  '#3465a4', '#75507b', '#06989a', '#d3d7cf',
  '#555753', '#ef2929', '#8ae234', '#fce94f',
  '#729fcf', '#ad7fa8', '#34e2e2', '#eeeeec',
];

function ansiColor(idx) {
  if (idx < 16) return ANSI_COLORS[idx] || '#c0caf5';
  if (idx < 232) {
    const n = idx - 16;
    const r = Math.floor(n / 36) * 51;
    const g = Math.floor((n % 36) / 6) * 51;
    const b = (n % 6) * 51;
    return `rgb(${r},${g},${b})`;
  }
  const gray = (idx - 232) * 10 + 8;
  return `rgb(${gray},${gray},${gray})`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showFormatPicker() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'snippet-prompt-overlay';
    overlay.innerHTML = `
      <div class="snippet-prompt" style="min-width: 280px">
        <div class="snippet-prompt-title">Export Format</div>
        <div class="export-format-options">
          <button class="export-format-btn" data-format="text">
            <span class="export-format-icon">TXT</span>
            <span>Plain Text</span>
          </button>
          <button class="export-format-btn" data-format="html">
            <span class="export-format-icon">HTML</span>
            <span>HTML (with colors)</span>
          </button>
          <button class="export-format-btn" data-format="ansi">
            <span class="export-format-icon">ANS</span>
            <span>Raw ANSI</span>
          </button>
        </div>
        <div class="snippet-prompt-buttons" style="margin-top: 12px">
          <button class="btn btn-secondary export-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    function done(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.querySelector('.export-cancel').addEventListener('click', () => done(null));
    overlay.querySelectorAll('.export-format-btn').forEach((btn) => {
      btn.addEventListener('click', () => done(btn.dataset.format));
    });

    overlay.setAttribute('tabindex', '-1');
    overlay.focus();
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') done(null);
    });
  });
}

function showSavePrompt(defaultPath) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'snippet-prompt-overlay';
    overlay.innerHTML = `
      <div class="snippet-prompt" style="min-width: 420px">
        <div class="snippet-prompt-title">Save As</div>
        <input type="text" class="snippet-prompt-input" style="font-family: 'JetBrains Mono', monospace; font-size: 12px" value="${escapeAttr(defaultPath)}" />
        <div class="snippet-prompt-buttons">
          <button class="btn btn-secondary export-prompt-cancel">Cancel</button>
          <button class="btn btn-primary export-prompt-save">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('.snippet-prompt-input');
    input.focus();
    // Select just the filename part
    const lastSlash = defaultPath.lastIndexOf('/');
    const dotPos = defaultPath.lastIndexOf('.');
    if (lastSlash >= 0 && dotPos > lastSlash) {
      input.setSelectionRange(lastSlash + 1, dotPos);
    } else {
      input.select();
    }

    function done(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.querySelector('.export-prompt-cancel').addEventListener('click', () => done(null));
    overlay.querySelector('.export-prompt-save').addEventListener('click', () => {
      const val = input.value.trim();
      done(val || null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value.trim();
        done(val || null);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        done(null);
      }
    });
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--glass-bg); backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border-strong); border-radius: 8px;
    padding: 10px 20px; color: var(--text-primary); font-size: 13px;
    z-index: 10001; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: cp-slide-in 0.15s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { exportTerminal };
