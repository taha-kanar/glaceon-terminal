// ── Clickable Paths & Links ──
// Custom xterm LinkProvider for file paths and stack traces

const LINK_PATTERNS = [
  // Absolute paths: /path/to/file:line:col
  {
    regex: /(\/[\w./-]+\.\w+)(?::(\d+))?(?::(\d+))?/g,
    extract: (m) => ({ path: m[1], line: parseInt(m[2]) || 1, col: parseInt(m[3]) || 1 }),
  },
  // Relative paths: ./path/to/file:line:col
  {
    regex: /(\.\/?[\w./-]+\.\w+)(?::(\d+))?(?::(\d+))?/g,
    extract: (m) => ({ path: m[1], line: parseInt(m[2]) || 1, col: parseInt(m[3]) || 1, relative: true }),
  },
  // Node.js stack traces: at Function (/path/to/file:10:5)
  {
    regex: /at\s+\S+\s+\(([^)]+):(\d+):(\d+)\)/g,
    extract: (m) => ({ path: m[1], line: parseInt(m[2]) || 1, col: parseInt(m[3]) || 1 }),
  },
  // Python stack traces: File "/path/to/file", line 10
  {
    regex: /File\s+"([^"]+)",\s+line\s+(\d+)/g,
    extract: (m) => ({ path: m[1], line: parseInt(m[2]) || 1, col: 1 }),
  },
  // Rust/Go: file.rs:10:5 or file.go:10:5
  {
    regex: /([\w./-]+\.(?:rs|go|ts|js|py|rb|java|c|cpp|h|hpp)):(\d+):(\d+)/g,
    extract: (m) => ({ path: m[1], line: parseInt(m[2]) || 1, col: parseInt(m[3]) || 1, relative: true }),
  },
];

function createLinkProvider(terminalId) {
  return {
    provideLinks(bufferLineNumber, callback) {
      const buffer = this._terminal ? this._terminal.buffer.active : null;
      if (!buffer) {
        callback([]);
        return;
      }

      const line = buffer.getLine(bufferLineNumber - 1);
      if (!line) {
        callback([]);
        return;
      }

      const text = line.translateToString(true);
      const links = [];

      for (const pattern of LINK_PATTERNS) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match;

        while ((match = regex.exec(text)) !== null) {
          const info = pattern.extract(match);
          const startCol = match.index;
          const endCol = match.index + match[0].length;

          links.push({
            range: {
              start: { x: startCol + 1, y: bufferLineNumber },
              end: { x: endCol + 1, y: bufferLineNumber },
            },
            text: match[0],
            data: { ...info, terminalId },
            activate: async (event, linkText, linkData) => {
              let filePath = linkData.path;

              // Resolve relative paths using terminal CWD
              if (linkData.relative && window.terminalAPI) {
                const cwd = await window.terminalAPI.getCwd(linkData.terminalId);
                if (cwd) {
                  const path = require('path');
                  filePath = path.resolve(cwd, filePath);
                }
              }

              openInEditor(filePath, linkData.line, linkData.col);
            },
            hover: (event, linkText) => {
              // Tooltip is handled by xterm itself
            },
          });
        }
      }

      callback(links);
    },
  };
}

async function openInEditor(filePath, line, col) {
  if (window.editorAPI) {
    await window.editorAPI.open(filePath, line || 1, col || 1);
  }
}

// Register the link provider with a terminal instance
function registerLinkProvider(term, terminalId) {
  const provider = createLinkProvider(terminalId);
  // Store terminal reference for buffer access
  provider._terminal = term;
  term.registerLinkProvider(provider);
}

module.exports = {
  createLinkProvider,
  registerLinkProvider,
  openInEditor,
};
