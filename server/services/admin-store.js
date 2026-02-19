/**
 * Admin Store Service
 * Reads/writes the admin list from data/admins.json.
 * Creates the file and directory on first write.
 * Supports running as a standalone executable (pkg) or as a normal Node.js app.
 *
 * Schema (credentials mode):
 *   { admins: [{ id, username, displayName, passwordHash, mustChangePassword,
 *                addedBy, addedAt, failedAttempts, lockedUntil }] }
 */
const fsp = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Resolve base directory: when packaged with pkg, use the exe's location;
// otherwise use the project root (two levels up from server/services/).
const BASE_DIR = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, '..', '..');

const DATA_DIR = path.join(BASE_DIR, 'data');
const ADMINS_PATH = path.join(DATA_DIR, 'admins.json');

async function readStore() {
  try {
    const raw = await fsp.readFile(ADMINS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { admins: [] };
  }
}

async function writeStore(store) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(ADMINS_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function normalizeUsername(username) {
  return (username || '').trim().toLowerCase();
}

async function getAdmins() {
  const store = await readStore();
  // Return safe view: strip passwordHash
  return store.admins.map(a => ({
    id: a.id,
    username: a.username,
    displayName: a.displayName,
    mustChangePassword: a.mustChangePassword || false,
    addedBy: a.addedBy,
    addedAt: a.addedAt
  }));
}

async function hasAnyAdmins() {
  const store = await readStore();
  return store.admins.length > 0;
}

async function findAdmin(username) {
  const store = await readStore();
  const norm = normalizeUsername(username);
  return store.admins.find(a => normalizeUsername(a.username) === norm) || null;
}

async function isAdmin(username) {
  const admin = await findAdmin(username);
  return !!admin;
}

async function addAdmin(username, displayName, password, mustChangePassword = false, addedBy = 'setup') {
  const store = await readStore();
  const norm = normalizeUsername(username);

  if (!norm) {
    return { added: false, reason: 'Username is required' };
  }

  if (store.admins.some(a => normalizeUsername(a.username) === norm)) {
    return { added: false, reason: 'Username already exists' };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  store.admins.push({
    id: uuidv4(),
    username: norm,
    displayName: displayName || norm,
    passwordHash,
    mustChangePassword,
    addedBy: addedBy || 'setup',
    addedAt: new Date().toISOString(),
    failedAttempts: 0,
    lockedUntil: null
  });

  await writeStore(store);
  return { added: true };
}

async function removeAdmin(username) {
  const store = await readStore();
  const norm = normalizeUsername(username);
  const before = store.admins.length;
  const filtered = store.admins.filter(a => normalizeUsername(a.username) !== norm);

  if (filtered.length === before) {
    return { removed: false, reason: 'Not found' };
  }
  if (filtered.length === 0) {
    return { removed: false, reason: 'Cannot remove the last admin' };
  }

  store.admins = filtered;
  await writeStore(store);
  return { removed: true };
}

async function verifyCredentials(username, password) {
  const store = await readStore();
  const norm = normalizeUsername(username);
  const admin = store.admins.find(a => normalizeUsername(a.username) === norm);

  if (!admin) {
    return { ok: false, reason: 'Invalid credentials' };
  }

  // Check lockout
  if (admin.lockedUntil) {
    const lockExpiry = new Date(admin.lockedUntil).getTime();
    if (Date.now() < lockExpiry) {
      const retryAfter = Math.ceil((lockExpiry - Date.now()) / 1000);
      return { ok: false, reason: 'Account temporarily locked', locked: true, retryAfter };
    }
    // Lock expired — reset
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    admin.failedAttempts = (admin.failedAttempts || 0) + 1;
    if (admin.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      admin.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
      console.warn(`[admin-store] Account "${norm}" locked after ${MAX_FAILED_ATTEMPTS} failed attempts`);
    }
    await writeStore(store);
    return { ok: false, reason: 'Invalid credentials' };
  }

  // Success — reset failure counters
  admin.failedAttempts = 0;
  admin.lockedUntil = null;
  await writeStore(store);

  return {
    ok: true,
    admin: {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      mustChangePassword: admin.mustChangePassword || false
    }
  };
}

async function updatePassword(username, newPassword) {
  const store = await readStore();
  const norm = normalizeUsername(username);
  const admin = store.admins.find(a => normalizeUsername(a.username) === norm);

  if (!admin) {
    return { ok: false, reason: 'Admin not found' };
  }

  admin.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  admin.mustChangePassword = false;
  await writeStore(store);
  return { ok: true };
}

module.exports = {
  getAdmins,
  hasAnyAdmins,
  isAdmin,
  findAdmin,
  addAdmin,
  removeAdmin,
  verifyCredentials,
  updatePassword
};
