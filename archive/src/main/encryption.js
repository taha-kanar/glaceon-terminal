const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;
const DIGEST = 'sha512';
const PREFIX = 'enc:v1:';
const VERIFICATION_PLAINTEXT = 'glaceon-terminal-encryption-ok';

let derivedKey = null;

function deriveKey(password, salt) {
  const saltBuf = Buffer.from(salt, 'base64');
  return crypto.pbkdf2Sync(password, saltBuf, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST);
}

function encrypt(plaintext) {
  if (!derivedKey) throw new Error('Encryption not unlocked');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + [iv, authTag, encrypted].map((b) => b.toString('base64')).join(':');
}

function decrypt(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  if (!derivedKey) throw new Error('Encryption not unlocked');
  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted value format');
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(data, null, 'utf8') + decipher.final('utf8');
}

function isEncryptedValue(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function setupEncryption(password, store) {
  const salt = crypto.randomBytes(32).toString('base64');
  derivedKey = deriveKey(password, salt);
  const verification = encrypt(VERIFICATION_PLAINTEXT);
  const keySource = password === _getIamKey(store) ? 'iam' : 'custom';
  store.set('encryption', { enabled: true, keySource, salt, verification });
  encryptSensitiveFields(store);
}

function unlock(password, store) {
  const config = store.get('encryption');
  if (!config || !config.enabled) return { success: false, error: 'Encryption is not enabled' };
  derivedKey = deriveKey(password, config.salt);
  try {
    const result = decrypt(config.verification);
    if (result !== VERIFICATION_PLAINTEXT) {
      derivedKey = null;
      return { success: false, error: 'Incorrect key' };
    }
    return { success: true };
  } catch (e) {
    derivedKey = null;
    return { success: false, error: 'Incorrect key' };
  }
}

function autoUnlockIfIam(store) {
  const config = store.get('encryption');
  if (!config || !config.enabled || config.keySource !== 'iam') return false;
  const iamKey = _getIamKey(store);
  if (!iamKey) return false;
  const result = unlock(iamKey, store);
  return result.success;
}

function lock() {
  if (derivedKey) {
    derivedKey.fill(0);
    derivedKey = null;
  }
}

function disableEncryption(store) {
  decryptSensitiveFields(store);
  store.set('encryption', { enabled: false, keySource: 'custom', salt: '', verification: '' });
  lock();
}

function changePassword(newPassword, store) {
  decryptSensitiveFields(store);
  lock();
  setupEncryption(newPassword, store);
}

function getStatus(store) {
  const config = store.get('encryption');
  return {
    isEnabled: !!(config && config.enabled),
    isUnlocked: derivedKey !== null,
    keySource: config ? config.keySource || 'custom' : 'custom',
  };
}

// ── Sensitive field helpers ──

const SENSITIVE_CLOUD_FIELDS = ['accessKeyId', 'secretAccessKey', 'pgPassword'];

function encryptSensitiveFields(store) {
  if (!derivedKey) return;

  // Cloud sync credentials
  const cloudSync = store.get('cloudSync');
  if (cloudSync) {
    let changed = false;
    for (const field of SENSITIVE_CLOUD_FIELDS) {
      if (cloudSync[field] && !isEncryptedValue(cloudSync[field])) {
        cloudSync[field] = encrypt(cloudSync[field]);
        changed = true;
      }
    }
    if (changed) store.set('cloudSync', cloudSync);
  }

  // SSH connection passwords
  const sshConnections = store.get('sshConnections') || [];
  let sshChanged = false;
  for (const conn of sshConnections) {
    if (conn.password && !isEncryptedValue(conn.password)) {
      conn.password = encrypt(conn.password);
      sshChanged = true;
    }
  }
  if (sshChanged) store.set('sshConnections', sshConnections);

  // Profile env vars
  const profiles = store.get('profiles') || [];
  let profilesChanged = false;
  for (const profile of profiles) {
    if (profile.env && typeof profile.env === 'object') {
      for (const key of Object.keys(profile.env)) {
        if (profile.env[key] && !isEncryptedValue(profile.env[key])) {
          profile.env[key] = encrypt(profile.env[key]);
          profilesChanged = true;
        }
      }
    }
  }
  if (profilesChanged) store.set('profiles', profiles);
}

function decryptSensitiveFields(store) {
  if (!derivedKey) return;

  const cloudSync = store.get('cloudSync');
  if (cloudSync) {
    let changed = false;
    for (const field of SENSITIVE_CLOUD_FIELDS) {
      if (isEncryptedValue(cloudSync[field])) {
        cloudSync[field] = decrypt(cloudSync[field]);
        changed = true;
      }
    }
    if (changed) store.set('cloudSync', cloudSync);
  }

  const sshConnections = store.get('sshConnections') || [];
  let sshChanged = false;
  for (const conn of sshConnections) {
    if (isEncryptedValue(conn.password)) {
      conn.password = decrypt(conn.password);
      sshChanged = true;
    }
  }
  if (sshChanged) store.set('sshConnections', sshConnections);

  const profiles = store.get('profiles') || [];
  let profilesChanged = false;
  for (const profile of profiles) {
    if (profile.env && typeof profile.env === 'object') {
      for (const key of Object.keys(profile.env)) {
        if (isEncryptedValue(profile.env[key])) {
          profile.env[key] = decrypt(profile.env[key]);
          profilesChanged = true;
        }
      }
    }
  }
  if (profilesChanged) store.set('profiles', profiles);
}

function decryptValue(value) {
  return decrypt(value);
}

function encryptValue(value) {
  if (!derivedKey) return value;
  if (isEncryptedValue(value)) return value;
  return encrypt(value);
}

function _getIamKey(store) {
  const cloudSync = store.get('cloudSync');
  if (!cloudSync) return '';
  // If the secret is already encrypted, decrypt it first
  if (isEncryptedValue(cloudSync.secretAccessKey)) {
    return decrypt(cloudSync.secretAccessKey);
  }
  return cloudSync.secretAccessKey || '';
}

module.exports = {
  encrypt: encryptValue,
  decrypt: decryptValue,
  isEncryptedValue,
  setupEncryption,
  unlock,
  autoUnlockIfIam,
  lock,
  disableEncryption,
  changePassword,
  getStatus,
  encryptSensitiveFields,
  decryptSensitiveFields,
};
