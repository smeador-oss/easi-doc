/**
 * Search Store
 * MiniSearch-powered full-text search index with persistence.
 * Indexes all markdown and JSON catalogue content across portals.
 */
const MiniSearch = require('minisearch');
const fsp = require('fs/promises');
const fs = require('fs');
const path = require('path');

const INDEX_FILE = '_search-index.json';
const MAX_BODY_LENGTH = 5000;

let miniSearch = null;
let portalsDir = null;
let persistTimer = null;
const indexedIds = new Set();

const MINISEARCH_OPTIONS = {
  fields: ['pageTitle', 'sectionTitle', 'portalTitle', 'body'],
  storeFields: ['portalId', 'portalTitle', 'contentPath', 'sectionTitle', 'pageTitle', 'type', 'body'],
  searchOptions: {
    boost: { pageTitle: 3, sectionTitle: 2, portalTitle: 1 },
    prefix: true,
    fuzzy: 0.2
  }
};

// ─── Markdown / JSON Text Extraction ────────────────────────

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, '')          // code blocks
    .replace(/`[^`]+`/g, '')                  // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')          // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')    // links → text
    .replace(/#{1,6}\s/g, '')                 // heading markers
    .replace(/[*_~]+/g, '')                   // bold/italic/strikethrough
    .replace(/>\s/g, '')                      // blockquotes
    .replace(/[-*+]\s/g, '')                  // list markers
    .replace(/\d+\.\s/g, '')                  // ordered list markers
    .replace(/\|/g, ' ')                      // table pipes
    .replace(/---+/g, '')                     // horizontal rules
    .replace(/\n{2,}/g, '\n')                 // collapse newlines
    .trim();
}

function extractJsonSearchText(jsonData) {
  const parts = [];
  if (jsonData.layer) parts.push(jsonData.layer);
  if (jsonData.title) parts.push(jsonData.title);
  if (jsonData.name) parts.push(jsonData.name);
  if (jsonData.description) parts.push(jsonData.description);
  const tables = jsonData.tables || jsonData.datasets || jsonData.entities || [];
  for (const table of tables) {
    if (table.name) parts.push(table.name);
    if (table.description) parts.push(table.description);
    if (table.domain) parts.push(table.domain);
    const columns = table.columns || table.fields || table.attributes || [];
    for (const col of columns) {
      if (col.name) parts.push(col.name);
      if (col.description) parts.push(col.description);
    }
  }
  return parts.join(' ');
}

// ─── Index Initialization ───────────────────────────────────

function createFreshIndex() {
  indexedIds.clear();
  return new MiniSearch(MINISEARCH_OPTIONS);
}

/**
 * Load persisted index from disk or build from scratch.
 */
async function loadOrBuild(dir) {
  portalsDir = dir;
  const indexPath = path.join(dir, INDEX_FILE);

  try {
    const raw = await fsp.readFile(indexPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data.version === 1 && data.index) {
      miniSearch = MiniSearch.loadJSON(data.index, MINISEARCH_OPTIONS);
      // Restore tracked IDs
      indexedIds.clear();
      if (data.ids && Array.isArray(data.ids)) {
        for (const id of data.ids) indexedIds.add(id);
      }
      console.log(`[search] Loaded persisted index (${miniSearch.documentCount} documents)`);
      return;
    }
  } catch {
    // Index missing or corrupt — rebuild
  }

  await buildFullIndex(dir);
}

/**
 * Full rebuild: scan all portals, read all content, populate index.
 */
async function buildFullIndex(dir) {
  portalsDir = dir;
  miniSearch = createFreshIndex();

  let docCount = 0;
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const portalDir = path.join(dir, entry.name);
      const portalId = entry.name;

      // Read portal title
      let portalTitle = portalId;
      try {
        const pj = JSON.parse(await fsp.readFile(path.join(portalDir, 'portal.json'), 'utf-8'));
        portalTitle = pj.title || portalId;
      } catch { /* use ID */ }

      // Read content index for section/page titles
      let contentIndex = null;
      try {
        const raw = await fsp.readFile(path.join(portalDir, 'content-index.json'), 'utf-8');
        contentIndex = JSON.parse(raw);
      } catch { /* no index */ }

      // Index all files from content index
      if (contentIndex && contentIndex.sections) {
        for (const section of contentIndex.sections) {
          if (section.isRootFile) {
            // Root-level file
            const content = await readFileContent(portalDir, section.path);
            if (content !== null) {
              const body = extractBody(content, section.type || (section.path.endsWith('.json') ? 'json' : 'md'));
              addDoc(portalId, portalTitle, section.path, '', section.title, body, section.type || 'md');
              docCount++;
            }
          } else if (section.pages) {
            for (const page of section.pages) {
              const content = await readFileContent(portalDir, page.path);
              if (content !== null) {
                const body = extractBody(content, page.type);
                addDoc(portalId, portalTitle, page.path, section.title, page.title, body, page.type);
                docCount++;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[search] Error scanning portals:', err.message);
  }

  console.log(`[search] Built full index: ${docCount} documents`);
  await persistNow();
}

// ─── Document CRUD ──────────────────────────────────────────

function makeId(portalId, contentPath) {
  return `${portalId}::${contentPath}`;
}

function addDoc(portalId, portalTitle, contentPath, sectionTitle, pageTitle, body, type) {
  const id = makeId(portalId, contentPath);
  // Remove existing if present (MiniSearch throws on duplicate IDs)
  if (indexedIds.has(id)) {
    try { miniSearch.discard(id); } catch { /* not found — fine */ }
  }
  miniSearch.add({
    id,
    portalId,
    portalTitle,
    contentPath,
    sectionTitle: sectionTitle || '',
    pageTitle: pageTitle || contentPath,
    body: (body || '').slice(0, MAX_BODY_LENGTH),
    type: type || 'md'
  });
  indexedIds.add(id);
}

/**
 * Index or re-index a single document after content CRUD.
 * Looks up portal/section titles from content-index.json.
 */
async function indexDocument(portalId, contentPath, content, type) {
  if (!miniSearch || !portalsDir) return;

  const portalDir = path.join(portalsDir, portalId);

  // Get portal title
  let portalTitle = portalId;
  try {
    const pj = JSON.parse(await fsp.readFile(path.join(portalDir, 'portal.json'), 'utf-8'));
    portalTitle = pj.title || portalId;
  } catch { /* use ID */ }

  // Get section/page titles from content index
  let sectionTitle = '';
  let pageTitle = contentPath;
  try {
    const raw = await fsp.readFile(path.join(portalDir, 'content-index.json'), 'utf-8');
    const idx = JSON.parse(raw);
    if (idx.sections) {
      for (const section of idx.sections) {
        if (section.isRootFile && section.path === contentPath) {
          pageTitle = section.title;
          break;
        }
        if (section.pages) {
          const page = section.pages.find(p => p.path === contentPath);
          if (page) {
            sectionTitle = section.title;
            pageTitle = page.title;
            break;
          }
        }
      }
    }
  } catch { /* use defaults */ }

  const body = extractBody(content, type);
  addDoc(portalId, portalTitle, contentPath, sectionTitle, pageTitle, body, type);
  schedulePersist();
}

/**
 * Remove a single document from the index.
 */
function removeDocument(portalId, contentPath) {
  if (!miniSearch) return;
  const id = makeId(portalId, contentPath);
  if (indexedIds.has(id)) {
    try { miniSearch.discard(id); } catch { /* not found */ }
    indexedIds.delete(id);
  }
  schedulePersist();
}

/**
 * Remove all documents for a portal.
 */
function removePortal(portalId) {
  if (!miniSearch) return;
  const prefix = `${portalId}::`;
  // Use MiniSearch's internal _documentIds to find matching documents
  const toRemove = [];
  // Search for all documents of this portal by doing a broad search
  // and filtering, then discard each. Alternatively, track IDs ourselves.
  // Since MiniSearch doesn't expose a doc iteration API, we maintain a
  // separate set of indexed IDs.
  for (const id of indexedIds) {
    if (id.startsWith(prefix)) {
      toRemove.push(id);
    }
  }
  for (const id of toRemove) {
    try { miniSearch.discard(id); indexedIds.delete(id); } catch { /* ignore */ }
  }
  schedulePersist();
}

/**
 * Re-index all content for a single portal.
 */
async function reindexPortal(portalId) {
  if (!miniSearch || !portalsDir) return;
  removePortal(portalId);

  const portalDir = path.join(portalsDir, portalId);

  let portalTitle = portalId;
  try {
    const pj = JSON.parse(await fsp.readFile(path.join(portalDir, 'portal.json'), 'utf-8'));
    portalTitle = pj.title || portalId;
  } catch { /* use ID */ }

  let contentIndex = null;
  try {
    const raw = await fsp.readFile(path.join(portalDir, 'content-index.json'), 'utf-8');
    contentIndex = JSON.parse(raw);
  } catch { return; }

  if (contentIndex && contentIndex.sections) {
    for (const section of contentIndex.sections) {
      if (section.isRootFile) {
        const content = await readFileContent(portalDir, section.path);
        if (content !== null) {
          const body = extractBody(content, section.type || 'md');
          addDoc(portalId, portalTitle, section.path, '', section.title, body, section.type || 'md');
        }
      } else if (section.pages) {
        for (const page of section.pages) {
          const content = await readFileContent(portalDir, page.path);
          if (content !== null) {
            const body = extractBody(content, page.type);
            addDoc(portalId, portalTitle, page.path, section.title, page.title, body, page.type);
          }
        }
      }
    }
  }

  schedulePersist();
}

// ─── Search ─────────────────────────────────────────────────

/**
 * Search the index.
 * @param {string} query
 * @param {Object} [options]
 * @param {string} [options.portalId] - Filter to a specific portal
 * @param {number} [options.limit=20] - Max results
 * @returns {Array} Results with snippets
 */
function search(query, options = {}) {
  if (!miniSearch || !query) return [];

  const limit = Math.min(options.limit || 20, 50);

  const searchOpts = {
    ...MINISEARCH_OPTIONS.searchOptions,
    filter: options.portalId
      ? (result) => result.portalId === options.portalId
      : undefined
  };

  const raw = miniSearch.search(query, searchOpts);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return raw.slice(0, limit).map(r => ({
    portalId: r.portalId,
    portalTitle: r.portalTitle,
    contentPath: r.contentPath,
    sectionTitle: r.sectionTitle,
    pageTitle: r.pageTitle,
    type: r.type,
    score: Math.round(r.score * 100) / 100,
    snippet: generateSnippet(r.body || '', terms)
  }));
}

// ─── Snippet Generation ─────────────────────────────────────

function generateSnippet(body, terms) {
  if (!body) return '';

  const lower = body.toLowerCase();

  // Find first occurrence of any term
  let bestPos = -1;
  for (const term of terms) {
    const pos = lower.indexOf(term);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
    }
  }

  if (bestPos === -1) {
    // No exact match — return start of body
    return escSnippet(body.slice(0, 120)) + (body.length > 120 ? '...' : '');
  }

  // Extract ~120 chars around the match
  const start = Math.max(0, bestPos - 40);
  const end = Math.min(body.length, bestPos + 80);
  let snippet = body.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < body.length) snippet += '...';

  // Wrap matched terms in <mark> tags
  snippet = escSnippet(snippet);
  for (const term of terms) {
    const re = new RegExp(`(${escapeRegex(term)})`, 'gi');
    snippet = snippet.replace(re, '<mark>$1</mark>');
  }

  return snippet;
}

function escSnippet(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Helpers ────────────────────────────────────────────────

async function readFileContent(portalDir, relativePath) {
  try {
    return await fsp.readFile(path.join(portalDir, relativePath), 'utf-8');
  } catch {
    return null;
  }
}

function extractBody(content, type) {
  if (type === 'json') {
    try {
      const data = JSON.parse(content);
      return extractJsonSearchText(data);
    } catch {
      return content;
    }
  }
  return stripMarkdown(content);
}

// ─── Persistence ────────────────────────────────────────────

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistNow().catch(err => {
    console.error('[search] Persist failed:', err.message);
  }), 500);
}

async function persistNow() {
  if (!miniSearch || !portalsDir) return;
  const indexPath = path.join(portalsDir, INDEX_FILE);
  const tmpPath = indexPath + '.tmp';
  const data = {
    version: 1,
    builtAt: new Date().toISOString(),
    ids: Array.from(indexedIds),
    index: JSON.stringify(miniSearch)
  };
  await fsp.writeFile(tmpPath, JSON.stringify(data), 'utf-8');
  await fsp.rename(tmpPath, indexPath);
}

module.exports = {
  loadOrBuild,
  buildFullIndex,
  indexDocument,
  removeDocument,
  removePortal,
  reindexPortal,
  search
};
