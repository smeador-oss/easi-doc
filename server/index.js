/**
 * easi-doc — Express Server
 * Serves the SPA frontend and provides a thin API for portal discovery and content serving.
 * Supports running as a standalone executable (pkg) or as a normal Node.js app.
 */
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const net = require('net');
const path = require('path');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const apiRouter = require('./routes/api');
const { migrateOrCreateIndex } = require('./services/content-index-store');
const searchStore = require('./services/search-store');

const app = express();
const PORT = process.env.PORT || 4242;

// Resolve base directory: when packaged with pkg, use the directory containing
// the exe; otherwise use the project root (one level up from server/).
const BASE_DIR = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, '..');

const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const PORTALS_DIR = path.join(BASE_DIR, 'portals');
const CONFIG_PATH = path.join(BASE_DIR, 'config.json');

// ─── Helpers ─────────────────────────────────────────────────

function openBrowser(url) {
  // Use spawn with detached+unref so the browser-open process survives
  // even if this process exits immediately after (second-click case).
  let child;
  switch (process.platform) {
    case 'win32':
      child = spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
      break;
    case 'darwin':
      child = spawn('open', [url], { detached: true, stdio: 'ignore' });
      break;
    default:
      child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
  }
  child.unref();
}

// Returns true if something is already listening on the given port.
function checkAlreadyRunning(port) {
  return new Promise((resolve) => {
    const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
      client.destroy();
      resolve(true);
    });
    client.on('error', () => resolve(false));
  });
}

// ─── First-run asset extraction (pkg exe only) ──────────────
// When bundled with pkg, assets live inside a read-only snapshot.
// On first launch we copy them next to the exe so the app can
// serve and modify them normally.

async function copyRecursive(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(s, d);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}

async function extractDefaults() {
  // Snapshot root is one level up from __dirname (server/)
  const snap = path.join(__dirname, '..');

  // Always overwrite public/ so app code stays in sync with the exe version.
  // This ensures upgrades (dropping a new exe into an existing folder) pick up
  // updated JS, CSS, and HTML immediately without a manual cleanup step.
  await copyRecursive(path.join(snap, 'public'), PUBLIC_DIR);

  // User data — only create on first run, never overwrite.
  if (!fs.existsSync(PORTALS_DIR)) {
    console.log('[startup] Extracting default portals...');
    await copyRecursive(path.join(snap, 'portals'), PORTALS_DIR);
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('[startup] Extracting default configuration...');
    await fsp.copyFile(path.join(snap, 'config.json'), CONFIG_PATH);
  }
  if (!fs.existsSync(path.join(BASE_DIR, 'data'))) {
    await fsp.mkdir(path.join(BASE_DIR, 'data'), { recursive: true });
  }
}

// ─── Startup ─────────────────────────────────────────────────

async function migrateContentIndices() {
  try {
    const entries = await fsp.readdir(PORTALS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const portalDir = path.join(PORTALS_DIR, entry.name);
      try {
        await migrateOrCreateIndex(portalDir, entry.name);
        console.log(`[startup] Content index ready: ${entry.name}`);
      } catch (err) {
        console.error(`[startup] Content index migration failed for ${entry.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[startup] Could not scan portals directory:', err.message);
  }
}

async function bootstrap() {
  // If already running (e.g. user double-clicked exe again after closing browser),
  // just open the browser to the existing instance and exit cleanly.
  if (process.pkg) {
    const running = await checkAlreadyRunning(PORT);
    if (running) {
      openBrowser(`http://localhost:${PORT}`);
      // Wait long enough for the detached browser process to be handed off
      // to the OS before we exit, then shut down cleanly.
      await new Promise(r => setTimeout(r, 800));
      process.exit(0);
    }
    await extractDefaults();
  }

  // Parse request bodies (for content push API + admin UI)
  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ limit: '5mb' }));

  // Static assets (CSS, JS, vendor, images)
  app.use(express.static(PUBLIC_DIR));

  // API routes
  app.use('/api', apiRouter({ portalsDir: PORTALS_DIR, configPath: CONFIG_PATH }));

  // SPA fallback — all other routes serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  // Migrate content indices and build search index
  await migrateContentIndices();
  try {
    await searchStore.loadOrBuild(PORTALS_DIR);
    console.log('[startup] Search index ready');
  } catch (err) {
    console.error('[startup] Search index build failed:', err.message);
  }

  // Start server
  app.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`easi-doc running at ${url}`);
    if (process.pkg) {
      openBrowser(url);
    }
  });
}

bootstrap().catch(err => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
