const Store = require('electron-store');

const schema = {
  activeThemeId: { type: 'string', default: 'tokyo-night' },
  glass: {
    type: 'object',
    properties: {
      opacity: { type: 'number', default: 0.72 },
      blur: { type: 'number', default: 40 },
      saturation: { type: 'number', default: 1.4 },
    },
    default: { opacity: 0.72, blur: 40, saturation: 1.4 },
  },
  customThemes: { type: 'array', default: [] },
  profiles: { type: 'array', default: [] },
  quake: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      shortcut: { type: 'string', default: 'CommandOrControl+`' },
      height: { type: 'number', default: 400 },
      autoHide: { type: 'boolean', default: true },
    },
    default: { enabled: true, shortcut: 'CommandOrControl+`', height: 400, autoHide: true },
  },
  snippets: { type: 'array', default: [] },
  sshConnections: { type: 'array', default: [] },
  settings: {
    type: 'object',
    default: {
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
      cursorStyle: 'bar',
      cursorBlink: true,
      scrollback: 10000,
      defaultShell: '',
      terminalOpacity: 1.0,
      defaultEditor: 'code',
      notificationsEnabled: true,
      notificationThreshold: 30,
      restoreSession: true,
      loggingEnabled: false,
      logDirectory: '',
    },
  },
  keybindings: { type: 'object', default: {} },
  notificationRules: { type: 'array', default: [] },
  cloudSync: {
    type: 'object',
    default: {
      enabled: false, provider: 'aws-s3', accessKeyId: '', secretAccessKey: '', bucket: '', region: 'us-east-1', endpoint: '',
      syncKey: 'glaceon-terminal/config.json',
      pgHost: '', pgPort: 5432, pgDatabase: '', pgUser: '', pgPassword: '', pgTable: 'cloud_sync_config', pgSsl: false,
    },
  },
  encryption: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: false },
      keySource: { type: 'string', default: 'custom' },
      salt: { type: 'string', default: '' },
      verification: { type: 'string', default: '' },
    },
    default: { enabled: false, keySource: 'custom', salt: '', verification: '' },
  },
  session: {
    type: 'object',
    default: { tabs: [], activeTabId: '', tabCounter: 0, tabGroups: [] },
  },
  lastSyncedAt: { type: 'string', default: '' },
  commandHistory: { type: 'array', default: [] },
  background: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['none', 'color', 'image'], default: 'none' },
      color: { type: 'string', default: '#1a1b26' },
      imagePath: { type: 'string', default: '' },
      imageData: { type: 'string', default: '' },
      imageScale: { type: 'string', enum: ['cover', 'contain', 'fill'], default: 'cover' },
      imageOpacity: { type: 'number', default: 1.0 },
    },
    default: { type: 'none', color: '#1a1b26', imagePath: '', imageData: '', imageScale: 'cover', imageOpacity: 1.0 },
  },
};

const store = new Store({
  name: 'config',
  schema,
  clearInvalidConfig: true,
});

module.exports = store;
