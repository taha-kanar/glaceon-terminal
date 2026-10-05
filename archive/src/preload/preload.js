const { ipcRenderer } = require('electron');

window.terminalAPI = {
  create: (id, profileId, cwdOverride) => ipcRenderer.invoke('terminal:create', id, profileId, cwdOverride),
  write: (id, data) => ipcRenderer.send('terminal:input', id, data),
  resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
  kill: (id) => ipcRenderer.send('terminal:kill', id),
  getCwd: (id) => ipcRenderer.invoke('terminal:getCwd', id),
  onData: (callback) => {
    ipcRenderer.on('terminal:data', (event, id, data) => callback(id, data));
  },
  onExit: (callback) => {
    ipcRenderer.on('terminal:exit', (event, id, exitCode) => callback(id, exitCode));
  },
  onProcessName: (callback) => {
    ipcRenderer.on('terminal:processName', (event, id, name) => callback(id, name));
  },
  onSshDetected: (cb) => {
    ipcRenderer.on('terminal:sshDetected', (event, id, host) => cb(id, host));
  },
  onCommandRunning: (cb) => {
    ipcRenderer.on('terminal:commandRunning', (event, id, name, startTime) => cb(id, name, startTime));
  },
  onCommandDone: (cb) => {
    ipcRenderer.on('terminal:commandDone', (event, id, name, durationMs) => cb(id, name, durationMs));
  },
  onProcessStats: (cb) => {
    ipcRenderer.on('terminal:processStats', (event, id, stats) => cb(id, stats));
  },
  getChildProcesses: (id) => ipcRenderer.invoke('terminal:getChildProcesses', id),
};

window.windowAPI = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  tearOff: (tabData) => ipcRenderer.invoke('window:tearOff', tabData),
};

window.settingsAPI = {
  get: (key) => ipcRenderer.invoke('settings:get', key),
  set: (key, value) => ipcRenderer.send('settings:set', key, value),
};

window.themeAPI = {
  getAll: () => ipcRenderer.invoke('theme:getAll'),
  save: (theme) => ipcRenderer.invoke('theme:save', theme),
  delete: (themeId) => ipcRenderer.invoke('theme:delete', themeId),
};

window.profileAPI = {
  getAll: () => ipcRenderer.invoke('profile:getAll'),
  save: (profile) => ipcRenderer.invoke('profile:save', profile),
  delete: (profileId) => ipcRenderer.invoke('profile:delete', profileId),
  getDefault: () => ipcRenderer.invoke('profile:getDefault'),
  setDefault: (profileId) => ipcRenderer.invoke('profile:setDefault', profileId),
};

window.quakeAPI = {
  getSettings: () => ipcRenderer.invoke('quake:getSettings'),
  setSettings: (settings) => ipcRenderer.send('quake:setSettings', settings),
  onShow: (callback) => {
    ipcRenderer.on('quake:show', () => callback());
  },
  onHide: (callback) => {
    ipcRenderer.on('quake:hide', () => callback());
  },
};

window.snippetAPI = {
  getAll: () => ipcRenderer.invoke('snippet:getAll'),
  save: (snippet) => ipcRenderer.invoke('snippet:save', snippet),
  delete: (id) => ipcRenderer.invoke('snippet:delete', id),
};

window.sshAPI = {
  parseConfig: () => ipcRenderer.invoke('ssh:parseConfig'),
  getSaved: () => ipcRenderer.invoke('ssh:getSaved'),
  save: (connection) => ipcRenderer.invoke('ssh:save', connection),
  delete: (id) => ipcRenderer.invoke('ssh:delete', id),
};

window.syncAPI = {
  push: () => ipcRenderer.invoke('sync:push'),
  pull: () => ipcRenderer.invoke('sync:pull'),
  test: () => ipcRenderer.invoke('sync:test'),
  applyPull: (data) => ipcRenderer.invoke('sync:applyPull', data),
  getConfig: () => ipcRenderer.invoke('sync:getConfig'),
  setConfig: (config) => ipcRenderer.send('sync:setConfig', config),
  getLastSynced: () => ipcRenderer.invoke('sync:getLastSynced'),
  onConfigUpdated: (cb) => ipcRenderer.on('sync:configUpdated', () => cb()),
};

window.notificationAPI = {
  show: (title, body) => ipcRenderer.send('notification:show', title, body),
};

window.dialogAPI = {
  showSave: (options) => ipcRenderer.invoke('dialog:showSave', options),
  showOpen: (options) => ipcRenderer.invoke('dialog:showOpen', options),
};

window.fileAPI = {
  write: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
  readBase64: (filePath) => ipcRenderer.invoke('file:readBase64', filePath),
};

window.editorAPI = {
  open: (filePath, line, col) => ipcRenderer.invoke('editor:open', filePath, line, col),
};

window.sessionAPI = {
  onSaveRequest: (cb) => ipcRenderer.on('session:save-request', (event, windowId) => cb(windowId)),
  confirmSaved: (windowId) => ipcRenderer.send(`session:save-done:${windowId}`),
  collectCwds: (ids) => ipcRenderer.invoke('session:collectCwds', ids),
};

window.loggingAPI = {
  start: (terminalId, logPath) => ipcRenderer.send('logging:start', terminalId, logPath),
  stop: (terminalId) => ipcRenderer.send('logging:stop', terminalId),
};

window.notificationRulesAPI = {
  getAll: () => ipcRenderer.invoke('notificationRules:getAll'),
  save: (rule) => ipcRenderer.invoke('notificationRules:save', rule),
  delete: (id) => ipcRenderer.invoke('notificationRules:delete', id),
};

window.commandHistoryAPI = {
  getAll: () => ipcRenderer.invoke('commandHistory:getAll'),
  save: (history) => ipcRenderer.send('commandHistory:save', history),
  clear: () => ipcRenderer.send('commandHistory:clear'),
};

window.sshHealthAPI = {
  checkLatency: (host) => ipcRenderer.invoke('ssh:checkLatency', host),
};

window.encryptionAPI = {
  getStatus: () => ipcRenderer.invoke('encryption:getStatus'),
  setup: (password, keySource) => ipcRenderer.invoke('encryption:setup', password, keySource),
  unlock: (password) => ipcRenderer.invoke('encryption:unlock', password),
  disable: (password) => ipcRenderer.invoke('encryption:disable', password),
  changePassword: (oldPassword, newPassword) => ipcRenderer.invoke('encryption:changePassword', oldPassword, newPassword),
};
