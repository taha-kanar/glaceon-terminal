<p align="center">
  <img src="assets/icon.png" alt="Glaceon Terminal" width="128" height="128">
</p>

<h1 align="center">Glaceon Terminal</h1>

<p align="center">
  <strong>A modern, GPU-accelerated terminal emulator with a glassmorphism UI</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Linux%20%7C%20Windows-blue" alt="Platform">
  <img src="https://img.shields.io/badge/electron-28-47848F?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#screenshots">Screenshots</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#keyboard-shortcuts">Keyboard Shortcuts</a> &bull;
  <a href="#themes">Themes</a> &bull;
  <a href="#cloud-sync">Cloud Sync</a> &bull;
  <a href="#building">Building</a>
</p>

---

## Screenshots

> Screenshots coming soon. Run `npm start` to see Glaceon Terminal in action.

---

## Features

### Glassmorphism UI
Glaceon Terminal is built around a fully transparent, blurred-glass aesthetic. Every panel, tab, modal, and context menu uses `backdrop-filter` for a frosted glass effect. Glass opacity, blur intensity, and saturation are all adjustable per-theme or globally.

### Split Panes & Tiling
- **Binary tree pane model** — split any pane horizontally (`Ctrl+Shift+E`) or vertically (`Ctrl+Shift+D`), infinitely nested
- **Drag-resizable dividers** between panes
- **Spatial navigation** — move focus between panes with `Ctrl+Alt+Arrow`
- **Zoom/unzoom** a single pane to fill the tab (`Ctrl+Shift+Z`)
- **Predefined tiling layouts** — 2 side-by-side, 2 stacked, 2x2 grid, and more
- **Drag-and-drop panes** between tabs or into new splits via grip handles

### Tabs
- Unlimited tabs with process name auto-detection in tab titles
- Tab coloring, renaming, locking, and pinning
- Drag-and-drop reorder
- Tab groups for organizing related terminals
- Right-click context menu with full tab management options
- Tear-off tabs into separate windows

### Quake Mode
A Quake-style dropdown terminal accessible from any application via a global hotkey (default: `` Ctrl+` ``). The terminal slides down from the top of the screen and hides when you press the shortcut again. Configurable height, auto-hide behavior, and animation.

### Command Palette
Press `Ctrl+Shift+P` to open a VS Code-style fuzzy-search command launcher. Every action in the app is registered and searchable — splits, themes, exports, SSH connections, snippets, and more.

### SSH Manager
- Parses your `~/.ssh/config` automatically
- Save, edit, and organize SSH connections
- One-click connect in a new tab
- **SSH health monitoring** — live latency indicator on SSH tabs with auto-reconnect banner on disconnect

### Snippet Manager
- Create, edit, and categorize reusable command snippets
- **Variable interpolation** — use `{{variables}}` that prompt for values on paste
- Fuzzy search across all snippets
- One-click paste to the active terminal

### Process Monitor
- Hover over any tab to see real-time **CPU and RAM usage** of its shell process
- Data sourced from `/proc` on Linux with 2-second polling interval

### Job Tracker
A floating panel (`Ctrl+Shift+J`) showing all child processes running across every terminal PTY. Useful for monitoring long-running builds, servers, or background tasks at a glance.

### Command History Timeline
A sidebar panel showing a scrollable timeline of commands across all terminals. Navigate back to any command with one click. Persisted across sessions (up to 500 entries).

### Clipboard Ring
Keeps the last 10 clipboard entries. Press `Ctrl+Alt+V` to open a popup and paste from any previous clipboard item instead of just the latest one.

### Terminal Search
Per-pane search bar (`Ctrl+Shift+F`) powered by `@xterm/addon-search`. Find and highlight matches within terminal output with next/previous navigation.

### Clickable Paths & Stack Traces
Automatically detects and makes clickable:
- Absolute and relative file paths (`/src/main.js:42:5`)
- Node.js stack traces (`at Function (/path/to/file:10:5)`)
- Python stack traces (`File "/path/to/file", line 10`)
- Rust/Go-style paths (`main.rs:42:5`)

Clicking opens the file in your configured editor (VS Code, Vim, etc.) at the exact line and column.

### Terminal Export
Export any terminal's buffer as:
- **Plain Text** (`.txt`)
- **HTML** with full color formatting
- **Raw ANSI** escape codes

### Scratch Pad
A collapsible notes area at the bottom of each tab. Jot down quick notes, TODOs, or reference info while working in the terminal. Content is saved per-tab.

### Notifications & Activity Badges
- **Badge indicators** on background tabs when new output arrives
- **System notifications** after a configurable period of silence (e.g., notify when a long build finishes)
- **Custom notification rules** — define regex patterns to trigger alerts on specific output

### Session Restore
Automatically saves and restores your entire workspace on restart — tabs, pane tree structure, and working directories. Controlled via settings (enabled by default).

### Terminal Logging
Record terminal sessions to timestamped log files. Configurable log directory (defaults to `~/.glaceon-terminal/logs`). Enable/disable globally via settings.

### Profiles
Create named profiles that override shell, arguments, working directory, environment variables, and font settings. Assign profiles to new tabs for different workflows (e.g., "Node Dev", "Remote Server", "Python").

### Encryption
AES-256-GCM encryption with PBKDF2 key derivation for sensitive data at rest. Encrypted values are prefixed with `enc:v1:`. Supports custom password or IAM key source for auto-unlock.

### Cloud Sync
Sync your settings, themes, profiles, snippets, SSH connections, and keybindings across machines via:
- **AWS S3**
- **MinIO** (self-hosted S3-compatible)
- **PostgreSQL**

All synced data can be encrypted end-to-end before upload.

---

## Themes

Glaceon Terminal ships with 6 built-in themes:

- **Tokyo Night**
- **Catppuccin Mocha**
- **Dracula**
- **Nord**
- **Gruvbox Dark**
- **Solarized Dark**

Plus a **custom theme editor** — create your own themes with full control over every color, glass property, and terminal palette. Custom themes are saved and synced via cloud sync.

---

## Installation

### Prerequisites
- **Node.js** 18+ and npm
- **GCC** and **Python** (required for compiling `node-pty`)

### From Source

```bash
git clone https://github.com/FicusTW/glaceon-terminal.git
cd glaceon-terminal
npm install
npm run rebuild   # Rebuild node-pty for Electron
npm start
```

### Pre-built Packages

| Platform | Format | Download |
|----------|--------|----------|
| Linux | AppImage | [Download](https://github.com/FicusTW/glaceon-terminal/releases/latest) |
| Linux | .deb | [Download](https://github.com/FicusTW/glaceon-terminal/releases/latest) |
| Linux | pacman | [Download](https://github.com/FicusTW/glaceon-terminal/releases/latest) |
| Windows | Installer | [Download](https://github.com/FicusTW/glaceon-terminal/releases/latest) |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cycle tabs |
| `Ctrl+1-9` / `Alt+1-9` | Jump to tab |
| `Ctrl+Shift+D` | Split pane vertically |
| `Ctrl+Shift+E` | Split pane horizontally |
| `Ctrl+Shift+W` | Close pane |
| `Ctrl+Alt+Arrow` | Navigate between panes |
| `Ctrl+Shift+Z` | Zoom/unzoom pane |
| `Ctrl+Shift+F` | Search in terminal |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+Shift+S` | Snippet manager |
| `Ctrl+Shift+J` | Job tracker |
| `Ctrl+Shift+X` | Export terminal |
| `Ctrl+Shift+C` | Copy |
| `Ctrl+Shift+V` | Paste |
| `Ctrl+Alt+V` | Clipboard ring |
| `Ctrl+Shift+N` | Toggle scratch pad |
| `Ctrl+Shift+H` | Command history |
| `` Ctrl+` `` | Toggle quake terminal |

---

## Cloud Sync

Glaceon Terminal can sync your configuration across multiple machines. Supported backends:

### AWS S3
```
Provider: aws-s3
Access Key ID: <your-key>
Secret Access Key: <your-secret>
Bucket: <your-bucket>
Region: us-east-1
```

### MinIO (Self-hosted)
```
Provider: minio
Endpoint: https://minio.example.com
Access Key ID: <your-key>
Secret Access Key: <your-secret>
Bucket: <your-bucket>
```

### PostgreSQL
```
Provider: postgresql
Host: db.example.com
Port: 5432
Database: glaceon_sync
User: <your-user>
Password: <your-password>
```

Synced data: themes, profiles, snippets, SSH connections, keybindings, glass settings, and background configuration.

---

## Building

```bash
# Linux AppImage (default)
npm run build

# Linux .deb
npm run build:deb

# Linux pacman
npm run build:pacman

# Windows installer (NSIS)
npm run build:win
```

Build output goes to the `dist/` directory.

---

## Architecture

Glaceon Terminal is a three-process Electron application:

```
┌─────────────────────────────────────────────┐
│  Main Process (src/main/main.js)            │
│  - Spawns PTY shells via node-pty            │
│  - Process polling (/proc)                   │
│  - Cloud sync, encryption                    │
│  - IPC hub                                   │
├─────────────────────────────────────────────┤
│  Preload (src/preload/preload.js)           │
│  - IPC bridge exposing typed APIs            │
├─────────────────────────────────────────────┤
│  Renderer (src/renderer/renderer.js)        │
│  - xterm.js terminals                        │
│  - Binary pane tree                          │
│  - Tab management                            │
│  - All UI modules                            │
└─────────────────────────────────────────────┘
```

The core data model is a **binary pane tree** per tab:
- `PaneLeaf` — holds a terminal instance
- `PaneBranch` — splits into two children with a direction and ratio

This allows infinitely nested splits with drag-resizable dividers.

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Electron, xterm.js, and node-pty
</p>
