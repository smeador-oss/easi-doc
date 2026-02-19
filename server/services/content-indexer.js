/**
 * Content Indexer Service
 * JavaScript port of build.ps1 — generates content-index on-the-fly
 * by scanning a portal's directory for .md and .json files.
 */
const fsp = require('fs/promises');
const path = require('path');

// Cache per portal: { [portalId]: { data, time } }
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function humanize(name) {
  // Remove extension, replace separators with spaces, title-case
  const base = path.basename(name, path.extname(name));
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function extractMarkdownTitle(filePath) {
  try {
    const content = await fsp.readFile(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, 20);
    for (const line of lines) {
      const match = line.match(/^\s*#\s+(.+)$/);
      if (match) return match[1].trim();
    }
  } catch { /* ignore */ }
  return null;
}

async function extractJsonTitle(filePath) {
  try {
    const data = JSON.parse(await fsp.readFile(filePath, 'utf-8'));
    return data.layer || data.title || data.name || null;
  } catch { /* ignore */ }
  return null;
}

async function getContentFiles(dirPath) {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && (e.name.endsWith('.md') || e.name.endsWith('.json')))
      .map(e => e.name)
      .sort();
  } catch { return []; }
}

async function discoverContentDirs(portalDir) {
  try {
    const entries = await fsp.readdir(portalDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort();
  } catch { return []; }
}

async function generateContentIndex(portalDir, portalId) {
  // Check cache
  const now = Date.now();
  const cached = cache.get(portalId);
  if (cached && (now - cached.time) < CACHE_TTL) return cached.data;

  // Read portal.json for optional contentDirs override
  let contentDirs = null;
  try {
    const portalJson = JSON.parse(await fsp.readFile(path.join(portalDir, 'portal.json'), 'utf-8'));
    contentDirs = portalJson.contentDirs || null;
  } catch { /* use auto-discovery */ }

  if (!contentDirs) {
    contentDirs = await discoverContentDirs(portalDir);
  }

  const index = [];
  let order = 0;

  for (const dir of contentDirs) {
    order++;
    const dirPath = path.join(portalDir, dir);
    const files = await getContentFiles(dirPath);
    const children = [];
    let childOrder = 0;

    for (const file of files) {
      childOrder++;
      const filePath = path.join(dirPath, file);
      const isJson = file.endsWith('.json');
      const title = isJson
        ? await extractJsonTitle(filePath)
        : await extractMarkdownTitle(filePath);

      children.push({
        title: title || humanize(file),
        path: `${dir}/${file}`,
        type: isJson ? 'json' : 'md',
        order: childOrder
      });
    }

    if (children.length > 0) {
      index.push({
        title: humanize(dir),
        path: dir,
        type: 'folder',
        children,
        order
      });
    }
  }

  // Root-level .md files (like README.md)
  const rootFiles = await getContentFiles(portalDir);
  for (const file of rootFiles) {
    // Skip metadata and README files (not portal content)
    if (file === 'portal.json' || file === 'config.json' || file.toLowerCase() === 'readme.md') continue;

    order++;
    const filePath = path.join(portalDir, file);
    const isJson = file.endsWith('.json');
    const title = isJson
      ? await extractJsonTitle(filePath)
      : await extractMarkdownTitle(filePath);

    const entry = {
      title: title || humanize(file),
      path: file,
      type: isJson ? 'json' : 'md',
      order
    };

    // Add icon hint for known files
    if (file.toLowerCase() === 'readme.md') entry.icon = 'help';

    index.push(entry);
  }

  cache.set(portalId, { data: index, time: now });
  return index;
}

function clearCache(portalId) {
  if (portalId) {
    cache.delete(portalId);
  } else {
    cache.clear();
  }
}

module.exports = { generateContentIndex, clearCache };
