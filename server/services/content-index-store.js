/**
 * Content Index Store
 * Persists a content-index.json per portal with stable UUID v4 IDs
 * for every section and page. Supports CRUD and migration from filesystem.
 */
const fsp = require('fs/promises');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const INDEX_FILE = 'content-index.json';
const ALLOWED_EXTENSIONS = new Set(['.md', '.json']);

// ─── Read / Write ────────────────────────────────────────────

/**
 * Read content-index.json from a portal directory.
 * Returns null if the file doesn't exist.
 */
async function readIndex(portalDir) {
  const filePath = path.join(portalDir, INDEX_FILE);
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Atomically write content-index.json to a portal directory.
 * Uses write-to-temp + rename for crash safety.
 */
async function writeIndex(portalDir, index) {
  const filePath = path.join(portalDir, INDEX_FILE);
  const tmpPath = filePath + '.tmp';
  const json = JSON.stringify(index, null, 2);
  await fsp.writeFile(tmpPath, json, 'utf-8');
  await fsp.rename(tmpPath, filePath);
}

// ─── Filesystem Helpers ──────────────────────────────────────

function humanize(name) {
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
      .filter(e => e.isFile() && ALLOWED_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
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

// ─── Migration / Creation ────────────────────────────────────

/**
 * Generate a content-index.json from the filesystem for a portal.
 * Assigns UUID v4 to every section and page.
 * If an index already exists, returns it; otherwise creates a new one.
 */
async function migrateOrCreateIndex(portalDir, portalId) {
  // If index already exists, return it
  const existing = await readIndex(portalDir);
  if (existing) return existing;

  // Read portal.json for optional contentDirs override
  let contentDirs = null;
  try {
    const portalJson = JSON.parse(await fsp.readFile(path.join(portalDir, 'portal.json'), 'utf-8'));
    contentDirs = portalJson.contentDirs || null;
  } catch { /* auto-discover */ }

  if (!contentDirs) {
    contentDirs = await discoverContentDirs(portalDir);
  }

  const now = new Date().toISOString();
  const sections = [];
  let sectionOrder = 0;

  for (const dir of contentDirs) {
    sectionOrder++;
    const dirPath = path.join(portalDir, dir);
    const files = await getContentFiles(dirPath);
    const pages = [];
    let pageOrder = 0;

    for (const file of files) {
      pageOrder++;
      const filePath = path.join(dirPath, file);
      const isJson = file.endsWith('.json');
      const title = isJson
        ? await extractJsonTitle(filePath)
        : await extractMarkdownTitle(filePath);

      // Get file stats for timestamps
      let createdAt = now;
      let modifiedAt = now;
      try {
        const stats = await fsp.stat(filePath);
        createdAt = stats.birthtime.toISOString();
        modifiedAt = stats.mtime.toISOString();
      } catch { /* use now */ }

      pages.push({
        id: uuidv4(),
        title: title || humanize(file),
        path: `${dir}/${file}`,
        type: isJson ? 'json' : 'md',
        order: pageOrder,
        createdAt,
        modifiedAt
      });
    }

    if (pages.length > 0) {
      sections.push({
        id: uuidv4(),
        title: humanize(dir),
        path: dir,
        order: sectionOrder,
        pages
      });
    }
  }

  // Root-level content files (not in any section folder)
  const rootFiles = await getContentFiles(portalDir);
  for (const file of rootFiles) {
    if (file === 'portal.json' || file === INDEX_FILE || file.toLowerCase() === 'readme.md') continue;

    sectionOrder++;
    const filePath = path.join(portalDir, file);
    const isJson = file.endsWith('.json');
    const title = isJson
      ? await extractJsonTitle(filePath)
      : await extractMarkdownTitle(filePath);

    let createdAt = now;
    let modifiedAt = now;
    try {
      const stats = await fsp.stat(filePath);
      createdAt = stats.birthtime.toISOString();
      modifiedAt = stats.mtime.toISOString();
    } catch { /* use now */ }

    // Root-level files become standalone entries (no section)
    sections.push({
      id: uuidv4(),
      title: title || humanize(file),
      path: file,
      type: isJson ? 'json' : 'md',
      isRootFile: true,
      order: sectionOrder,
      createdAt,
      modifiedAt
    });
  }

  const index = {
    portalId,
    version: 1,
    generatedAt: now,
    sections
  };

  await writeIndex(portalDir, index);
  return index;
}

// ─── CRUD Operations ─────────────────────────────────────────

/**
 * Add a new section to the index.
 * Returns the new section object.
 */
async function addSection(portalDir, { title, dirName }) {
  const index = await readIndex(portalDir);
  if (!index) throw new Error('Content index not found');

  const maxOrder = index.sections.reduce((max, s) => Math.max(max, s.order || 0), 0);
  const section = {
    id: uuidv4(),
    title,
    path: dirName,
    order: maxOrder + 1,
    pages: []
  };

  index.sections.push(section);
  await writeIndex(portalDir, index);
  return section;
}

/**
 * Add a new page to a section.
 * @param {string} sectionId - UUID of the target section
 * Returns the new page object.
 */
async function addPage(portalDir, sectionId, { title, fileName, type = 'md' }) {
  const index = await readIndex(portalDir);
  if (!index) throw new Error('Content index not found');

  const section = index.sections.find(s => s.id === sectionId);
  if (!section) throw new Error('Section not found');
  if (!section.pages) throw new Error('Cannot add pages to a root-level file entry');

  const now = new Date().toISOString();
  const maxOrder = (section.pages || []).reduce((max, p) => Math.max(max, p.order || 0), 0);
  const page = {
    id: uuidv4(),
    title,
    path: `${section.path}/${fileName}`,
    type,
    order: maxOrder + 1,
    createdAt: now,
    modifiedAt: now
  };

  section.pages.push(page);
  await writeIndex(portalDir, index);
  return page;
}

/**
 * Update an existing page's metadata.
 * Returns the updated page or null if not found.
 */
async function updatePage(portalDir, pageId, updates) {
  const index = await readIndex(portalDir);
  if (!index) throw new Error('Content index not found');

  for (const section of index.sections) {
    // Check root-level file entries
    if (section.isRootFile && section.id === pageId) {
      if (updates.title !== undefined) section.title = updates.title;
      section.modifiedAt = new Date().toISOString();
      await writeIndex(portalDir, index);
      return section;
    }
    // Check pages in sections
    if (section.pages) {
      const page = section.pages.find(p => p.id === pageId);
      if (page) {
        if (updates.title !== undefined) page.title = updates.title;
        page.modifiedAt = new Date().toISOString();
        await writeIndex(portalDir, index);
        return page;
      }
    }
  }
  return null;
}

/**
 * Remove a page from the index.
 * Returns { removed: true } or { removed: false, reason }.
 */
async function removePage(portalDir, pageId) {
  const index = await readIndex(portalDir);
  if (!index) return { removed: false, reason: 'Content index not found' };

  for (let i = 0; i < index.sections.length; i++) {
    const section = index.sections[i];

    // Check root-level file entries
    if (section.isRootFile && section.id === pageId) {
      index.sections.splice(i, 1);
      await writeIndex(portalDir, index);
      return { removed: true, path: section.path };
    }

    // Check pages in sections
    if (section.pages) {
      const pageIdx = section.pages.findIndex(p => p.id === pageId);
      if (pageIdx !== -1) {
        const page = section.pages.splice(pageIdx, 1)[0];
        await writeIndex(portalDir, index);
        return { removed: true, path: page.path };
      }
    }
  }

  return { removed: false, reason: 'Page not found' };
}

/**
 * Remove an entire section from the index.
 * Returns { removed: true, pages } or { removed: false, reason }.
 */
async function removeSection(portalDir, sectionId) {
  const index = await readIndex(portalDir);
  if (!index) return { removed: false, reason: 'Content index not found' };

  const idx = index.sections.findIndex(s => s.id === sectionId);
  if (idx === -1) return { removed: false, reason: 'Section not found' };

  const section = index.sections.splice(idx, 1)[0];
  await writeIndex(portalDir, index);
  return { removed: true, path: section.path, pages: section.pages || [] };
}

// ─── Lookup ──────────────────────────────────────────────────

/**
 * Find a section or page by UUID across the entire index.
 * Returns { type: 'section'|'page', item, section? } or null.
 */
function findByUuid(index, uuid) {
  if (!index || !uuid) return null;

  for (const section of index.sections) {
    if (section.id === uuid) {
      return { type: section.isRootFile ? 'page' : 'section', item: section };
    }
    if (section.pages) {
      for (const page of section.pages) {
        if (page.id === uuid) {
          return { type: 'page', item: page, section };
        }
      }
    }
  }
  return null;
}

// ─── API Shape Conversion ────────────────────────────────────

/**
 * Convert the persisted index to the legacy nav-tree API response format.
 * This maintains backward compatibility with the existing client code.
 *
 * Input (persisted):
 *   { portalId, version, sections: [{ id, title, path, order, pages: [{ id, title, path, type, order }] }] }
 *
 * Output (legacy):
 *   [{ title, path, type: 'folder', order, children: [{ title, path, type, order }] }]
 */
function toApiShape(index) {
  if (!index || !index.sections) return [];

  return index.sections
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(section => {
      // Root-level file entry (not a folder)
      if (section.isRootFile) {
        return {
          id: section.id,
          title: section.title,
          path: section.path,
          type: section.type,
          order: section.order
        };
      }

      // Section folder with children
      const children = (section.pages || [])
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(page => ({
          id: page.id,
          title: page.title,
          path: page.path,
          type: page.type,
          order: page.order
        }));

      return {
        id: section.id,
        title: section.title,
        path: section.path,
        type: 'folder',
        order: section.order,
        children
      };
    });
}

module.exports = {
  readIndex,
  writeIndex,
  migrateOrCreateIndex,
  addSection,
  addPage,
  updatePage,
  removePage,
  removeSection,
  findByUuid,
  toApiShape
};
