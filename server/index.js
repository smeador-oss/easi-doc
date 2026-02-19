/**
 * easi-doc — Express Server
 * Serves the SPA frontend and provides a thin API for portal discovery and content serving.
 * Supports running as a standalone executable (pkg) or as a normal Node.js app.
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fsp = require('fs/promises');
const { exec } = require('child_process');
const apiRouter = require('./routes/api');
const { migrateOrCreateIndex } = require('./services/content-index-store');
const searchStore = require('./services/search-store');

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve base directory: when packaged with pkg, use the exe's location;
// otherwise use the project root (one level up from server/).
const BASE_DIR = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, '..');

const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const PORTALS_DIR = path.join(BASE_DIR, 'portals');
const CONFIG_PATH = path.join(BASE_DIR, 'config.json');

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

// ─── Startup: Migrate content indices ────────────────────────
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

migrateContentIndices().then(async () => {
  try {
    await searchStore.loadOrBuild(PORTALS_DIR);
    console.log('[startup] Search index ready');
  } catch (err) {
    console.error('[startup] Search index build failed:', err.message);
  }
});

app.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`easi-doc running at ${url}`);

  // Auto-open browser when running as standalone executable
  if (process.pkg) {
    console.log('Opening browser...');
    switch (process.platform) {
      case 'win32': exec(`start ${url}`); break;
      case 'darwin': exec(`open ${url}`); break;
      default: exec(`xdg-open ${url}`); break;
    }
  }
});
