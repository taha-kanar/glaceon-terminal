const path = require('path');
const appRoot = path.resolve(__dirname, '..', '..');
require('module-alias').addAliases({
  '@data': path.join(appRoot, 'data'),
  '@themes': path.join(appRoot, 'themes'),
  '@main': path.join(appRoot, 'src', 'main'),
  '@preload': path.join(appRoot, 'src', 'preload'),
  '@renderer': path.join(appRoot, 'src', 'renderer'),
});
const { app, BrowserWindow, ipcMain, globalShortcut, screen, Notification, dialog } = require('electron');
const pty = require('node-pty');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const store = require('@data/store');
const cloudSync = require('@main/cloud-sync');
const encryption = require('@main/encryption');

const shells = new Map(); // id -> { pty, webContents }
let mainWindow;
let quakeWindow = null;
let processNameInterval = null;


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'Glaceon Terminal',
    icon: path.join(appRoot, 'assets', 'icon.png'),
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Auto-unlock encryption if using IAM key source
  encryption.autoUnlockIfIam(store);

  createWindow();

  // Register quake mode shortcut
  const quakeSettings = store.get('quake');
  if (quakeSettings.enabled) {
    try {
      globalShortcut.register(quakeSettings.shortcut, toggleQuakeWindow);
    } catch (e) {
      // shortcut registration may fail
    }
  }

  // Start process name polling
  startProcessNamePolling();
});

app.on('before-quit', (e) => {
  // Prevent immediate quit so renderer can persist session state first
  e.preventDefault();
  const windows = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  if (windows.length === 0) { app.exit(0); return; }

  let pending = windows.length;
  const done = () => { if (--pending === 0) app.exit(0); };

  windows.forEach((win) => {
    // Give each window up to 2s to confirm save, then proceed
    const timeout = setTimeout(done, 2000);
    ipcMain.once(`session:save-done:${win.id}`, () => {
      clearTimeout(timeout);
      done();
    });
    win.webContents.send('session:save-request', win.id);
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (processNameInterval) clearInterval(processNameInterval);
  encryption.lock();
  cloudSync.resetClient();
});

app.on('window-all-closed', () => {
  shells.forEach((entry) => entry.pty.kill());
  shells.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

const defaultShell = os.platform() === 'win32'
  ? 'powershell.exe'
  : process.env.SHELL || '/bin/bash';

// ── Settings IPC ──
ipcMain.handle('settings:get', (event, key) => {
  return store.get(key);
});

ipcMain.on('settings:set', (event, key, value) => {
  store.set(key, value);
});

// ── Theme IPC ──
ipcMain.handle('theme:getAll', () => {
  return store.get('customThemes') || [];
});

ipcMain.handle('theme:save', (event, theme) => {
  const themes = store.get('customThemes') || [];
  const idx = themes.findIndex((t) => t.id === theme.id);
  if (idx >= 0) themes[idx] = theme;
  else themes.push(theme);
  store.set('customThemes', themes);
  return themes;
});

ipcMain.handle('theme:delete', (event, themeId) => {
  const themes = (store.get('customThemes') || []).filter((t) => t.id !== themeId);
  store.set('customThemes', themes);
  if (store.get('activeThemeId') === themeId) store.set('activeThemeId', 'tokyo-night');
  return themes;
});

// ── Profile IPC ──
ipcMain.handle('profile:getAll', () => {
  return store.get('profiles') || [];
});

ipcMain.handle('profile:save', (event, profile) => {
  const profiles = store.get('profiles') || [];
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  store.set('profiles', profiles);
  return profiles;
});

ipcMain.handle('profile:delete', (event, profileId) => {
  const profiles = (store.get('profiles') || []).filter((p) => p.id !== profileId);
  store.set('profiles', profiles);
  return profiles;
});

ipcMain.handle('profile:getDefault', () => {
  const profiles = store.get('profiles') || [];
  const def = profiles.find((p) => p.isDefault);
  return def || null;
});

ipcMain.handle('profile:setDefault', (event, profileId) => {
  const profiles = store.get('profiles') || [];
  profiles.forEach((p) => { p.isDefault = p.id === profileId; });
  store.set('profiles', profiles);
  return profiles;
});

// ── Terminal IPC ──
ipcMain.handle('terminal:create', (event, id, profileId, cwdOverride) => {
  // Check settings for default shell override
  const appSettings = store.get('settings') || {};
  let shell = appSettings.defaultShell || defaultShell;
  let args = [];
  let cwd = os.homedir();
  let env = { ...process.env, TERM: 'xterm-256color' };

  // Apply profile if provided (overrides default shell)
  if (profileId) {
    const profiles = store.get('profiles') || [];
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      if (profile.shell) shell = profile.shell;
      if (profile.args && profile.args.length) args = profile.args;
      if (profile.cwd) cwd = profile.cwd;
      if (profile.env) {
        const decryptedEnv = {};
        for (const [k, v] of Object.entries(profile.env)) {
          decryptedEnv[k] = encryption.isEncryptedValue(v) ? encryption.decrypt(v) : v;
        }
        env = { ...env, ...decryptedEnv };
      }
    }
  }

  // cwdOverride takes precedence (used by session restore)
  if (cwdOverride) {
    try {
      if (fs.existsSync(cwdOverride) && fs.statSync(cwdOverride).isDirectory()) {
        cwd = cwdOverride;
      }
    } catch (e) {
      // fallback to default cwd
    }
  }

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env,
  });

  shells.set(id, { pty: ptyProcess, webContents: event.sender });

  ptyProcess.onData((data) => {
    const entry = shells.get(id);
    if (entry && entry.webContents && !entry.webContents.isDestroyed()) {
      entry.webContents.send('terminal:data', id, data);
    }
    // F9: Terminal Logging
    const logStream = loggingStreams.get(id);
    if (logStream) logStream.write(data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    const entry = shells.get(id);
    if (entry && entry.webContents && !entry.webContents.isDestroyed()) {
      entry.webContents.send('terminal:exit', id, exitCode);
    }
    shells.delete(id);
    const logStream = loggingStreams.get(id);
    if (logStream) {
      logStream.end();
      loggingStreams.delete(id);
    }
  });

  return { id, shell };
});

ipcMain.on('terminal:input', (event, id, data) => {
  const entry = shells.get(id);
  if (entry) entry.pty.write(data);
});

ipcMain.on('terminal:resize', (event, id, cols, rows) => {
  const entry = shells.get(id);
  if (entry) {
    try {
      entry.pty.resize(cols, rows);
    } catch (e) {
      // ignore resize errors on dead processes
    }
  }
});

ipcMain.on('terminal:kill', (event, id) => {
  const entry = shells.get(id);
  if (entry) {
    entry.pty.kill();
    shells.delete(id);
  }
  const logStream = loggingStreams.get(id);
  if (logStream) {
    logStream.end();
    loggingStreams.delete(id);
  }
});

// ── Terminal CWD (for tab enhancements) ──
ipcMain.handle('terminal:getCwd', (event, id) => {
  const entry = shells.get(id);
  if (!entry) return null;
  try {
    const pid = entry.pty.pid;
    if (process.platform === 'linux') {
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    } else if (process.platform === 'darwin') {
      // macOS: use lsof
      const { execSync } = require('child_process');
      const result = execSync(`lsof -p ${pid} -Fn | grep '^n/' | head -1`, { encoding: 'utf8' });
      return result.trim().slice(1);
    }
  } catch (e) {
    return null;
  }
  return null;
});

// ── Batch CWD collection (for session save) ──
ipcMain.handle('session:collectCwds', (event, ids) => {
  const cwdMap = {};
  for (const id of ids) {
    const entry = shells.get(id);
    if (!entry) continue;
    try {
      const pid = entry.pty.pid;
      if (process.platform === 'linux') {
        cwdMap[id] = fs.readlinkSync(`/proc/${pid}/cwd`);
      } else if (process.platform === 'darwin') {
        const { execSync } = require('child_process');
        const result = execSync(`lsof -p ${pid} -Fn | grep '^n/' | head -1`, { encoding: 'utf8' });
        cwdMap[id] = result.trim().slice(1);
      }
    } catch (e) {
      // process may have exited
    }
  }
  return cwdMap;
});

// ── Process Name Polling ──
function startProcessNamePolling() {
  if (process.platform !== 'linux' && process.platform !== 'darwin') return;

  processNameInterval = setInterval(() => {
    shells.forEach((entry, id) => {
      try {
        const pid = entry.pty.pid;
        let processName = null;
        let fgPid = null;

        if (process.platform === 'linux') {
          // Read foreground process group
          // Parse carefully: comm field (index 1) is wrapped in parens and may contain spaces
          const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
          const commEnd = stat.lastIndexOf(')');
          if (commEnd !== -1) {
            const afterComm = stat.slice(commEnd + 2); // skip ') '
            const fields = afterComm.split(' ');
            // After comm: state(0) ppid(1) pgrp(2) session(3) tty_nr(4) tpgid(5)
            const tpgid = fields[5];
            if (tpgid && tpgid !== '-1') {
              fgPid = tpgid;
              try {
                processName = fs.readFileSync(`/proc/${tpgid}/comm`, 'utf8').trim();
              } catch (e) {
                // tpgid process may have exited
              }
            }
          }
        }

        if (processName && entry.webContents && !entry.webContents.isDestroyed()) {
          entry.webContents.send('terminal:processName', id, processName);

          // ── SSH Detection (F3) ──
          if (processName === 'ssh' && fgPid) {
            try {
              const cmdline = fs.readFileSync(`/proc/${fgPid}/cmdline`, 'utf8');
              const args = cmdline.split('\0').filter(Boolean);
              // Extract host from ssh command args (last non-flag argument)
              let host = '';
              for (let i = args.length - 1; i >= 1; i--) {
                if (!args[i].startsWith('-')) { host = args[i]; break; }
              }
              entry.webContents.send('terminal:sshDetected', id, host || 'unknown');
            } catch (e) {
              entry.webContents.send('terminal:sshDetected', id, 'unknown');
            }
          }

          // ── Command Duration (F5) ──
          const shellBasenames = ['bash', 'zsh', 'fish', 'sh', 'dash', 'csh', 'tcsh', 'ksh', 'nu', 'pwsh', 'powershell'];
          const isShell = shellBasenames.includes(processName);
          if (!isShell) {
            if (!entry.commandStartTime) {
              entry.commandStartTime = Date.now();
              entry.lastFgProcess = processName;
            }
            entry.webContents.send('terminal:commandRunning', id, processName, entry.commandStartTime);
          } else {
            if (entry.commandStartTime) {
              const duration = Date.now() - entry.commandStartTime;
              entry.webContents.send('terminal:commandDone', id, entry.lastFgProcess || '', duration);
              entry.commandStartTime = null;
              entry.lastFgProcess = null;
            }
          }

          // ── Process Stats (F4) ──
          if (fgPid && process.platform === 'linux') {
            try {
              const statusContent = fs.readFileSync(`/proc/${fgPid}/status`, 'utf8');
              const vmRssMatch = statusContent.match(/VmRSS:\s+(\d+)/);
              const vmRssKb = vmRssMatch ? parseInt(vmRssMatch[1]) : 0;

              const fgStat = fs.readFileSync(`/proc/${fgPid}/stat`, 'utf8');
              const fgFields = fgStat.split(' ');
              const utime = parseInt(fgFields[13]) || 0;
              const stime = parseInt(fgFields[14]) || 0;

              entry.webContents.send('terminal:processStats', id, {
                pid: parseInt(fgPid),
                processName,
                vmRssKb,
                utime,
                stime,
              });
            } catch (e) {
              // process may have exited
            }
          }
        }
      } catch (e) {
        // process may have exited
      }
    });
  }, 2000);
}

// ── Child Processes (F11: Job Tracker) ──
ipcMain.handle('terminal:getChildProcesses', (event, id) => {
  const entry = shells.get(id);
  if (!entry) return [];
  try {
    const pid = entry.pty.pid;
    if (process.platform !== 'linux') return [];
    const childrenFile = `/proc/${pid}/task/${pid}/children`;
    const childPids = fs.readFileSync(childrenFile, 'utf8').trim().split(/\s+/).filter(Boolean);
    const processes = [];
    for (const cpid of childPids) {
      try {
        const comm = fs.readFileSync(`/proc/${cpid}/comm`, 'utf8').trim();
        const statContent = fs.readFileSync(`/proc/${cpid}/stat`, 'utf8');
        const fields = statContent.split(' ');
        const state = fields[2] || '?';
        processes.push({ pid: parseInt(cpid), command: comm, state });
      } catch (e) {
        // child may have exited
      }
    }
    return processes;
  } catch (e) {
    return [];
  }
});

// ── Logging (F9) ──
const loggingStreams = new Map(); // terminalId -> WriteStream

ipcMain.on('logging:start', (event, terminalId, logPath) => {
  try {
    const dir = path.dirname(logPath);
    fs.mkdirSync(dir, { recursive: true });
    const stream = fs.createWriteStream(logPath, { flags: 'a' });
    loggingStreams.set(terminalId, stream);
  } catch (e) {
    // logging start failure
  }
});

ipcMain.on('logging:stop', (event, terminalId) => {
  const stream = loggingStreams.get(terminalId);
  if (stream) {
    stream.end();
    loggingStreams.delete(terminalId);
  }
});

// ── Notification Rules (F10) ──
ipcMain.handle('notificationRules:getAll', () => {
  return store.get('notificationRules') || [];
});

ipcMain.handle('notificationRules:save', (event, rule) => {
  const rules = store.get('notificationRules') || [];
  const idx = rules.findIndex((r) => r.id === rule.id);
  if (idx >= 0) rules[idx] = rule;
  else rules.push(rule);
  store.set('notificationRules', rules);
  return rules;
});

ipcMain.handle('notificationRules:delete', (event, id) => {
  const rules = (store.get('notificationRules') || []).filter((r) => r.id !== id);
  store.set('notificationRules', rules);
  return rules;
});

// ── Command History IPC ──
ipcMain.handle('commandHistory:getAll', () => {
  return store.get('commandHistory') || [];
});

ipcMain.on('commandHistory:save', (event, history) => {
  store.set('commandHistory', history || []);
});

ipcMain.on('commandHistory:clear', () => {
  store.set('commandHistory', []);
});

// ── SSH Health Check (Latency) ──
ipcMain.handle('ssh:checkLatency', (event, host) => {
  return new Promise((resolve) => {
    if (!host || host === 'unknown') { resolve(null); return; }
    // Sanitize host - only allow alphanumeric, dots, hyphens, colons (IPv6)
    if (!/^[a-zA-Z0-9.\-:@]+$/.test(host)) { resolve(null); return; }
    // Strip user@ prefix if present
    const cleanHost = host.includes('@') ? host.split('@').pop() : host;
    if (!cleanHost) { resolve(null); return; }
    const timeout = setTimeout(() => { resolve(null); }, 5000);
    const proc = spawn('ping', ['-c', '1', '-W', '3', cleanHost], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) { resolve(null); return; }
      const match = output.match(/time[=<]([\d.]+)\s*ms/);
      resolve(match ? parseFloat(match[1]) : null);
    });
    proc.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
});

// ── Window Controls ──
ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

// ── Tear-Off (new window from tab) ──
ipcMain.handle('window:tearOff', (event, tabData) => {
  const newWin = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    title: 'Glaceon Terminal',
    icon: path.join(appRoot, 'assets', 'icon.png'),
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  newWin.loadFile(path.join(__dirname, '../renderer/index.html'));
  return { windowId: newWin.id };
});

// ── Snippet IPC ──
ipcMain.handle('snippet:getAll', () => {
  return store.get('snippets') || [];
});

ipcMain.handle('snippet:save', (event, snippet) => {
  const snippets = store.get('snippets') || [];
  const idx = snippets.findIndex((s) => s.id === snippet.id);
  if (idx >= 0) snippets[idx] = snippet;
  else snippets.push(snippet);
  store.set('snippets', snippets);
  return snippets;
});

ipcMain.handle('snippet:delete', (event, id) => {
  const snippets = (store.get('snippets') || []).filter((s) => s.id !== id);
  store.set('snippets', snippets);
  return snippets;
});

// ── SSH IPC ──
ipcMain.handle('ssh:parseConfig', () => {
  try {
    const configPath = path.join(os.homedir(), '.ssh', 'config');
    if (fs.existsSync(configPath)) {
      return fs.readFileSync(configPath, 'utf8');
    }
  } catch (e) {
    // SSH config may not exist
  }
  return '';
});

ipcMain.handle('ssh:getSaved', () => {
  const connections = store.get('sshConnections') || [];
  const status = encryption.getStatus(store);
  if (status.isEnabled && status.isUnlocked) {
    return connections.map((c) => ({
      ...c,
      password: c.password && encryption.isEncryptedValue(c.password) ? encryption.decrypt(c.password) : (c.password || ''),
    }));
  }
  return connections;
});

ipcMain.handle('ssh:save', (event, connection) => {
  const status = encryption.getStatus(store);
  if (status.isEnabled && status.isUnlocked && connection.password && !encryption.isEncryptedValue(connection.password)) {
    connection.password = encryption.encrypt(connection.password);
  }
  const connections = store.get('sshConnections') || [];
  const idx = connections.findIndex((c) => c.id === connection.id);
  if (idx >= 0) connections[idx] = connection;
  else connections.push(connection);
  store.set('sshConnections', connections);
  return connections;
});

ipcMain.handle('ssh:delete', (event, id) => {
  const connections = (store.get('sshConnections') || []).filter((c) => c.id !== id);
  store.set('sshConnections', connections);
  return connections;
});

// ── Notification IPC ──
ipcMain.on('notification:show', (event, title, body) => {
  if (Notification.isSupported()) {
    const notif = new Notification({ title, body });
    notif.show();
  }
});

// ── Dialog IPC ──
ipcMain.handle('dialog:showSave', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  // Ensure defaultPath is an absolute path (GTK native dialog needs this on Linux)
  let defaultPath = options.defaultPath || 'export.txt';
  if (!path.isAbsolute(defaultPath)) {
    defaultPath = path.join(os.homedir(), defaultPath);
  }
  const result = await dialog.showSaveDialog(win, {
    title: options.title || 'Save',
    defaultPath,
    filters: options.filters || [],
  });
  return result.canceled ? null : result.filePath;
});

// ── Dialog Open IPC ──
ipcMain.handle('dialog:showOpen', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: options.title || 'Open',
    filters: options.filters || [],
    properties: options.properties || ['openFile'],
  });
  return result.canceled ? null : result.filePaths;
});

// ── File Read Base64 IPC ──
ipcMain.handle('file:readBase64', (event, filePath) => {
  try {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml' }[ext] || 'image/png';
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch (e) {
    return null;
  }
});

// ── File Write IPC ──
ipcMain.handle('file:write', (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (e) {
    return false;
  }
});

// ── Editor Open IPC ──
ipcMain.handle('editor:open', (event, filePath, line, col) => {
  const settings = store.get('settings') || {};
  const editor = settings.defaultEditor || 'code';

  let args = [];
  switch (editor) {
    case 'code':
      args = ['--goto', `${filePath}:${line}:${col}`];
      break;
    case 'subl':
      args = [`${filePath}:${line}:${col}`];
      break;
    case 'vim':
    case 'nvim':
      // vim can't be opened externally easily, spawn in terminal
      args = [`+${line}`, filePath];
      break;
    case 'emacs':
      args = [`+${line}:${col}`, filePath];
      break;
    case 'nano':
      args = [`+${line},${col}`, filePath];
      break;
    default:
      args = [filePath];
  }

  try {
    spawn(editor, args, { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    // editor may not be installed
  }
  return true;
});

// ── Terminal Create: Use default shell from settings ──
// (The existing handler already handles this via profile, but we also check settings)

// ── Quake Mode ──
function createQuakeWindow() {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  const quakeSettings = store.get('quake');

  quakeWindow = new BrowserWindow({
    width,
    height: quakeSettings.height || 400,
    x: 0,
    y: 0,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    resizable: true,
    show: false,
    icon: path.join(appRoot, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  quakeWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
    query: { mode: 'quake' },
  });

  if (quakeSettings.autoHide) {
    quakeWindow.on('blur', () => {
      if (quakeWindow && quakeWindow.isVisible()) {
        quakeWindow.hide();
        quakeWindow.webContents.send('quake:hide');
      }
    });
  }

  quakeWindow.on('closed', () => {
    quakeWindow = null;
  });
}

function toggleQuakeWindow() {
  if (!quakeWindow) {
    createQuakeWindow();
    quakeWindow.once('ready-to-show', () => {
      quakeWindow.show();
      quakeWindow.focus();
      quakeWindow.webContents.send('quake:show');
    });
    return;
  }

  if (quakeWindow.isVisible()) {
    quakeWindow.hide();
    quakeWindow.webContents.send('quake:hide');
  } else {
    // Reposition to top of current display
    const display = screen.getPrimaryDisplay();
    const { width } = display.workAreaSize;
    const quakeSettings = store.get('quake');
    quakeWindow.setBounds({ x: 0, y: 0, width, height: quakeSettings.height || 400 });
    quakeWindow.show();
    quakeWindow.focus();
    quakeWindow.webContents.send('quake:show');
  }
}

ipcMain.handle('quake:getSettings', () => {
  return store.get('quake');
});

// ── Cloud Sync IPC ──
ipcMain.handle('sync:push', async () => {
  try {
    return await cloudSync.pushToCloud();
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('sync:pull', async () => {
  try {
    return await cloudSync.pullFromCloud();
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('sync:test', async () => {
  try {
    return await cloudSync.testConnection();
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('sync:applyPull', (event, data) => {
  cloudSync.applyPulledData(data);
  // Broadcast to all windows
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('sync:configUpdated');
    }
  });
  return { success: true };
});

ipcMain.handle('sync:getConfig', () => {
  const config = { ...store.get('cloudSync') };
  const status = encryption.getStatus(store);
  if (status.isEnabled && status.isUnlocked) {
    if (encryption.isEncryptedValue(config.accessKeyId)) config.accessKeyId = encryption.decrypt(config.accessKeyId);
    if (encryption.isEncryptedValue(config.secretAccessKey)) config.secretAccessKey = encryption.decrypt(config.secretAccessKey);
    if (encryption.isEncryptedValue(config.pgPassword)) config.pgPassword = encryption.decrypt(config.pgPassword);
  }
  return config;
});

ipcMain.on('sync:setConfig', (event, config) => {
  const status = encryption.getStatus(store);
  if (status.isEnabled && status.isUnlocked) {
    if (config.accessKeyId && !encryption.isEncryptedValue(config.accessKeyId)) {
      config.accessKeyId = encryption.encrypt(config.accessKeyId);
    }
    if (config.secretAccessKey && !encryption.isEncryptedValue(config.secretAccessKey)) {
      config.secretAccessKey = encryption.encrypt(config.secretAccessKey);
    }
    if (config.pgPassword && !encryption.isEncryptedValue(config.pgPassword)) {
      config.pgPassword = encryption.encrypt(config.pgPassword);
    }
  }
  store.set('cloudSync', config);
  cloudSync.resetClient();
});

ipcMain.handle('sync:getLastSynced', () => {
  return store.get('lastSyncedAt');
});

// ── Encryption IPC ──
ipcMain.handle('encryption:getStatus', () => {
  return encryption.getStatus(store);
});

ipcMain.handle('encryption:setup', (event, password, keySource) => {
  try {
    const actualPassword = keySource === 'iam'
      ? (store.get('cloudSync')?.secretAccessKey || '')
      : password;
    if (!actualPassword) return { success: false, error: 'No key provided' };
    encryption.setupEncryption(actualPassword, store);
    // Override keySource if it was explicitly set
    if (keySource === 'iam') {
      const enc = store.get('encryption');
      enc.keySource = 'iam';
      store.set('encryption', enc);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('encryption:unlock', (event, password) => {
  return encryption.unlock(password, store);
});

ipcMain.handle('encryption:disable', (event, password) => {
  try {
    const config = store.get('encryption');
    if (config.keySource === 'iam') {
      const iamKey = store.get('cloudSync')?.secretAccessKey || '';
      // If currently encrypted, we need to verify with the derived key
      const status = encryption.getStatus(store);
      if (!status.isUnlocked) {
        const unlockResult = encryption.unlock(iamKey, store);
        if (!unlockResult.success) return { success: false, error: 'Could not unlock with IAM key' };
      }
    } else {
      const status = encryption.getStatus(store);
      if (!status.isUnlocked) {
        const unlockResult = encryption.unlock(password, store);
        if (!unlockResult.success) return unlockResult;
      }
    }
    encryption.disableEncryption(store);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('encryption:changePassword', (event, oldPassword, newPassword) => {
  try {
    const status = encryption.getStatus(store);
    if (!status.isUnlocked) {
      const unlockResult = encryption.unlock(oldPassword, store);
      if (!unlockResult.success) return unlockResult;
    }
    encryption.changePassword(newPassword, store);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.on('quake:setSettings', (event, settings) => {
  const oldSettings = store.get('quake');
  store.set('quake', settings);

  // Unregister only the previous shortcut, then re-register if enabled
  if (oldSettings && oldSettings.shortcut) {
    globalShortcut.unregister(oldSettings.shortcut);
  }
  if (settings.enabled) {
    try {
      globalShortcut.register(settings.shortcut, toggleQuakeWindow);
    } catch (e) {
      // shortcut may be invalid
    }
  }
});
