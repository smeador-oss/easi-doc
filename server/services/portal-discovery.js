/**
 * Portal Discovery Service
 * Scans the portals/ directory for subdirectories containing portal.json.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function humanize(name) {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function discoverPortals(portalsDir) {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) return cache;

  const entries = await fsp.readdir(portalsDir, { withFileTypes: true });
  const portals = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

    const portalJsonPath = path.join(portalsDir, entry.name, 'portal.json');
    try {
      const raw = await fsp.readFile(portalJsonPath, 'utf-8');
      const meta = JSON.parse(raw);
      portals.push({
        id: entry.name,
        title: meta.title || humanize(entry.name),
        subtitle: meta.subtitle || '',
        icon: meta.icon || 'file',
        order: meta.order ?? 999
      });
    } catch {
      // No portal.json or invalid JSON — skip this directory
    }
  }

  portals.sort((a, b) => a.order - b.order);
  cache = portals;
  cacheTime = now;
  return portals;
}

function clearCache() {
  cache = null;
  cacheTime = 0;
}

module.exports = { discoverPortals, clearCache };
