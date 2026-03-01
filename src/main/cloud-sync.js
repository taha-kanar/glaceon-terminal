const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const store = require('@data/store');
const encryption = require('@main/encryption');

const SYNC_KEYS = [
  'activeThemeId', 'glass', 'customThemes', 'profiles', 'quake',
  'snippets', 'sshConnections', 'settings', 'keybindings', 'background',
  'commandHistory',
];

let s3Client = null;
let cachedS3Credentials = null;
let pgClient = null;

// ── S3 Client (shared by aws-s3 and minio) ──

function getS3Client() {
  const config = store.get('cloudSync');
  let accessKeyId = config.accessKeyId;
  let secretAccessKey = config.secretAccessKey;

  if (encryption.isEncryptedValue(accessKeyId)) accessKeyId = encryption.decrypt(accessKeyId);
  if (encryption.isEncryptedValue(secretAccessKey)) secretAccessKey = encryption.decrypt(secretAccessKey);

  const credKey = `${config.provider}:${accessKeyId}:${secretAccessKey}:${config.region}:${config.endpoint}`;

  if (s3Client && cachedS3Credentials === credKey) return s3Client;

  const s3Options = {
    region: config.region || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
  };

  if (config.provider === 'minio' && config.endpoint) {
    s3Options.endpoint = config.endpoint;
    s3Options.forcePathStyle = true;
  }

  s3Client = new S3Client(s3Options);
  cachedS3Credentials = credKey;
  return s3Client;
}

// ── PostgreSQL Client ──

function sanitizeTableName(name) {
  if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid table name: "${name}". Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`);
  }
  return name;
}

async function getPgClient() {
  if (pgClient) {
    // Health check — if the client is broken, recreate it
    try {
      await pgClient.query('SELECT 1');
      return pgClient;
    } catch (e) {
      try { await pgClient.end(); } catch (_) {}
      pgClient = null;
    }
  }

  const { Client } = require('pg');
  const config = store.get('cloudSync');

  let password = config.pgPassword;
  if (encryption.isEncryptedValue(password)) password = encryption.decrypt(password);

  pgClient = new Client({
    host: config.pgHost,
    port: config.pgPort || 5432,
    database: config.pgDatabase,
    user: config.pgUser,
    password,
    ssl: config.pgSsl ? { rejectUnauthorized: false } : false,
  });

  await pgClient.connect();
  return pgClient;
}

async function ensurePgTable(client, tableName) {
  const safe = sanitizeTableName(tableName);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${safe} (
      sync_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// ── Provider checks ──

function getProvider() {
  const config = store.get('cloudSync');
  return config.provider || 'aws-s3';
}

function isConfigured() {
  const config = store.get('cloudSync');
  if (!config.enabled) return false;

  const provider = config.provider || 'aws-s3';
  switch (provider) {
    case 'aws-s3':
      return !!(config.accessKeyId && config.secretAccessKey && config.bucket);
    case 'minio':
      return !!(config.accessKeyId && config.secretAccessKey && config.bucket && config.endpoint);
    case 'postgresql':
      return !!(config.pgHost && config.pgDatabase && config.pgUser);
    default:
      return false;
  }
}

// ── Build payload (shared) ──

function buildPayload() {
  const data = {};
  for (const key of SYNC_KEYS) {
    data[key] = store.get(key);
  }

  const status = encryption.getStatus(store);
  if (status.isEnabled && status.isUnlocked) {
    const jsonStr = JSON.stringify(data);
    const encryptedPayload = encryption.encrypt(jsonStr);
    return JSON.stringify({ version: 2, encrypted: true, timestamp: new Date().toISOString(), payload: encryptedPayload });
  }
  return JSON.stringify({ version: 1, timestamp: new Date().toISOString(), data });
}

function parsePayload(body) {
  const parsed = JSON.parse(body);
  const lastSynced = store.get('lastSyncedAt');
  const isNewer = !lastSynced || new Date(parsed.timestamp) > new Date(lastSynced);

  let data;
  if (parsed.version === 2 && parsed.encrypted) {
    const status = encryption.getStatus(store);
    if (!status.isEnabled || !status.isUnlocked) {
      return { data: null, isNewer: false, encrypted: true, error: 'Remote config is encrypted but encryption is not unlocked' };
    }
    const decrypted = encryption.decrypt(parsed.payload);
    data = JSON.parse(decrypted);
  } else {
    data = parsed.data;
  }

  return { data, isNewer, timestamp: parsed.timestamp };
}

// ── S3 operations (aws-s3 + minio) ──

async function s3Push() {
  const config = store.get('cloudSync');
  const s3 = getS3Client();
  const payload = buildPayload();

  await s3.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: config.syncKey || 'glaceon-terminal/config.json',
    Body: payload,
    ContentType: 'application/json',
  }));
}

async function s3Pull() {
  const config = store.get('cloudSync');
  const s3 = getS3Client();

  let response;
  try {
    response = await s3.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: config.syncKey || 'glaceon-terminal/config.json',
    }));
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return { data: null, isNewer: false };
    }
    throw err;
  }

  const body = await response.Body.transformToString();
  return parsePayload(body);
}

async function s3Test() {
  const config = store.get('cloudSync');
  const s3 = getS3Client();

  try {
    await s3.send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: config.syncKey || 'glaceon-terminal/config.json',
    }));
    return { success: true, message: 'Connection successful — config found in bucket' };
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return { success: true, message: 'Connection successful — bucket accessible (no existing config)' };
    }
    throw err;
  }
}

// ── PostgreSQL operations ──

async function pgPush() {
  const config = store.get('cloudSync');
  const client = await getPgClient();
  const tableName = sanitizeTableName(config.pgTable || 'cloud_sync_config');
  await ensurePgTable(client, tableName);

  const payload = buildPayload();
  const syncKey = config.syncKey || 'glaceon-terminal/config.json';

  await client.query(
    `INSERT INTO ${tableName} (sync_key, payload, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (sync_key) DO UPDATE SET payload = $2, updated_at = NOW()`,
    [syncKey, payload]
  );
}

async function pgPull() {
  const config = store.get('cloudSync');
  const client = await getPgClient();
  const tableName = sanitizeTableName(config.pgTable || 'cloud_sync_config');
  await ensurePgTable(client, tableName);

  const syncKey = config.syncKey || 'glaceon-terminal/config.json';
  const result = await client.query(
    `SELECT payload FROM ${tableName} WHERE sync_key = $1`,
    [syncKey]
  );

  if (result.rows.length === 0) {
    return { data: null, isNewer: false };
  }

  return parsePayload(result.rows[0].payload);
}

async function pgTest() {
  const config = store.get('cloudSync');
  const client = await getPgClient();
  const tableName = sanitizeTableName(config.pgTable || 'cloud_sync_config');
  await ensurePgTable(client, tableName);

  const syncKey = config.syncKey || 'glaceon-terminal/config.json';
  const result = await client.query(
    `SELECT 1 FROM ${tableName} WHERE sync_key = $1`,
    [syncKey]
  );

  if (result.rows.length > 0) {
    return { success: true, message: 'Connection successful — config found in database' };
  }
  return { success: true, message: 'Connection successful — table ready (no existing config)' };
}

// ── Dispatch ──

async function pushToCloud() {
  if (!isConfigured()) throw new Error('Cloud sync is not configured');

  const provider = getProvider();
  if (provider === 'postgresql') {
    await pgPush();
  } else {
    await s3Push();
  }

  store.set('lastSyncedAt', new Date().toISOString());
  return { success: true };
}

async function pullFromCloud() {
  if (!isConfigured()) throw new Error('Cloud sync is not configured');

  const provider = getProvider();
  if (provider === 'postgresql') {
    return await pgPull();
  }
  return await s3Pull();
}

function applyPulledData(data) {
  for (const key of SYNC_KEYS) {
    if (data[key] !== undefined) {
      store.set(key, data[key]);
    }
  }
  store.set('lastSyncedAt', new Date().toISOString());
}

async function testConnection() {
  if (!isConfigured()) throw new Error('Cloud sync is not configured');

  const provider = getProvider();
  if (provider === 'postgresql') {
    return await pgTest();
  }
  return await s3Test();
}

function resetClient() {
  s3Client = null;
  cachedS3Credentials = null;
  if (pgClient) {
    try { pgClient.end(); } catch (_) {}
    pgClient = null;
  }
}

module.exports = { resetClient, isConfigured, pushToCloud, pullFromCloud, applyPulledData, testConnection };
