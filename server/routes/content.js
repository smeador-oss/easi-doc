/**
 * Content Route Handlers
 * Serves and pushes content files (markdown, JSON) within portals.
 */
const express = require('express');
const path = require('path');
const fsp = require('fs/promises');
const { clearCache: clearIndexCache } = require('../services/content-indexer');
const { readIndex, writeIndex, removePage } = require('../services/content-index-store');
const { v4: uuidv4 } = require('uuid');
const { isValidPortalId, isValidContentPath, humanize } = require('../utils/validation');
const searchStore = require('../services/search-store');

/**
 * Creates the content router.
 * @param {Object} opts
 * @param {string} opts.portalsDir - Absolute path to the portals/ directory
 * @param {Function} opts.requireAdmin - Admin middleware from auth module
 * @param {boolean} opts.isAdminEnabled - Whether admin features are active
 */
function createContentRouter({ portalsDir, requireAdmin, isAdminEnabled }) {
  const router = express.Router();

  // POST /api/portals/:id/content/* — push content files (admin-only)
  if (isAdminEnabled) {
    router.post('/:id/content/*', requireAdmin, async (req, res) => {
      const portalId = req.params.id;
      if (!isValidPortalId(portalId)) {
        return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
      }

      const contentPath = req.params[0];
      if (!isValidContentPath(contentPath)) {
        return res.status(400).json({ error: 'Invalid content path', code: 'INVALID_PATH' });
      }

      const filePath = path.join(portalsDir, portalId, contentPath);

      // Security: ensure resolved path is still inside the portal directory
      const resolvedPath = path.resolve(filePath);
      const portalRoot = path.resolve(path.join(portalsDir, portalId));
      if (!resolvedPath.startsWith(portalRoot + path.sep) && resolvedPath !== portalRoot) {
        return res.status(400).json({ error: 'Invalid path', code: 'INVALID_PATH' });
      }

      try {
        // Create subdirectories if they don't exist
        await fsp.mkdir(path.dirname(filePath), { recursive: true });

        const content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2);
        await fsp.writeFile(filePath, content, 'utf-8');

        // Register in persisted content-index with a UUID
        let pageId = null;
        const portalDir = path.join(portalsDir, portalId);
        try {
          const index = await readIndex(portalDir);
          if (index) {
            const now = new Date().toISOString();
            const ext = path.extname(contentPath).toLowerCase();
            const isJson = ext === '.json';
            const fileName = path.basename(contentPath);
            const fileBaseName = path.basename(contentPath, ext);

            // Determine section from path (e.g. "guides/overview.md" → section path "guides")
            const parts = contentPath.split('/');
            if (parts.length >= 2) {
              const sectionPath = parts.slice(0, -1).join('/');
              let section = index.sections.find(s => s.path === sectionPath && !s.isRootFile);

              // Auto-create section if it doesn't exist
              if (!section) {
                const maxOrder = index.sections.reduce((m, s) => Math.max(m, s.order || 0), 0);
                section = {
                  id: uuidv4(),
                  title: humanize(sectionPath.split('/').pop()),
                  path: sectionPath,
                  order: maxOrder + 1,
                  pages: []
                };
                index.sections.push(section);
              }

              // Check if page already exists (by path)
              const existing = section.pages.find(p => p.path === contentPath);
              if (existing) {
                existing.modifiedAt = now;
                pageId = existing.id;
              } else {
                const maxPageOrder = section.pages.reduce((m, p) => Math.max(m, p.order || 0), 0);
                const newPage = {
                  id: uuidv4(),
                  title: isJson ? (req.body?.layer || req.body?.title || humanize(fileBaseName)) : humanize(fileBaseName),
                  path: contentPath,
                  type: isJson ? 'json' : 'md',
                  order: maxPageOrder + 1,
                  createdAt: now,
                  modifiedAt: now
                };
                section.pages.push(newPage);
                pageId = newPage.id;
              }
            } else {
              // Root-level file
              const existing = index.sections.find(s => s.isRootFile && s.path === contentPath);
              if (existing) {
                existing.modifiedAt = now;
                pageId = existing.id;
              } else {
                const maxOrder = index.sections.reduce((m, s) => Math.max(m, s.order || 0), 0);
                const entry = {
                  id: uuidv4(),
                  title: isJson ? (req.body?.layer || req.body?.title || humanize(fileBaseName)) : humanize(fileBaseName),
                  path: contentPath,
                  type: isJson ? 'json' : 'md',
                  isRootFile: true,
                  order: maxOrder + 1,
                  createdAt: now,
                  modifiedAt: now
                };
                index.sections.push(entry);
                pageId = entry.id;
              }
            }

            await writeIndex(portalDir, index);
          }
        } catch (indexErr) {
          console.error(`[api] Content index update failed for ${portalId}/${contentPath}:`, indexErr.message);
          // Non-fatal — file was written successfully
        }

        // Clear legacy content-index cache
        clearIndexCache(portalId);

        // Update search index (non-blocking)
        const type = path.extname(contentPath).toLowerCase() === '.json' ? 'json' : 'md';
        searchStore.indexDocument(portalId, contentPath, content, type)
          .catch(err => console.error('[search] Index update failed:', err.message));

        res.json({ ok: true, path: contentPath, pageId });
      } catch (err) {
        console.error(`[api] Content push failed for ${portalId}/${contentPath}:`, err);
        res.status(500).json({ error: 'Failed to write content', code: 'WRITE_FAILED' });
      }
    });
  }

  // PUT /api/portals/:id/content/* — update existing content (admin-only)
  if (isAdminEnabled) {
    router.put('/:id/content/*', requireAdmin, async (req, res) => {
      const portalId = req.params.id;
      if (!isValidPortalId(portalId)) {
        return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
      }

      const contentPath = req.params[0];
      if (!isValidContentPath(contentPath)) {
        return res.status(400).json({ error: 'Invalid content path', code: 'INVALID_PATH' });
      }

      const filePath = path.join(portalsDir, portalId, contentPath);
      const resolvedPath = path.resolve(filePath);
      const portalRoot = path.resolve(path.join(portalsDir, portalId));
      if (!resolvedPath.startsWith(portalRoot + path.sep) && resolvedPath !== portalRoot) {
        return res.status(400).json({ error: 'Invalid path', code: 'INVALID_PATH' });
      }

      // File must exist for PUT (use POST to create new)
      try {
        await fsp.access(filePath);
      } catch {
        return res.status(404).json({ error: 'Content not found', code: 'CONTENT_NOT_FOUND' });
      }

      try {
        const content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2);
        await fsp.writeFile(filePath, content, 'utf-8');

        // Update modifiedAt in content-index
        const portalDir = path.join(portalsDir, portalId);
        let pageId = null;
        try {
          const index = await readIndex(portalDir);
          if (index) {
            const now = new Date().toISOString();
            // Find by path across all sections
            for (const section of index.sections) {
              if (section.isRootFile && section.path === contentPath) {
                section.modifiedAt = now;
                // Update title from content for JSON
                if (section.type === 'json' && typeof req.body === 'object') {
                  const newTitle = req.body?.layer || req.body?.title || req.body?.name;
                  if (newTitle) section.title = newTitle;
                }
                pageId = section.id;
                break;
              }
              if (section.pages) {
                const page = section.pages.find(p => p.path === contentPath);
                if (page) {
                  page.modifiedAt = now;
                  if (page.type === 'json' && typeof req.body === 'object') {
                    const newTitle = req.body?.layer || req.body?.title || req.body?.name;
                    if (newTitle) page.title = newTitle;
                  }
                  pageId = page.id;
                  break;
                }
              }
            }
            await writeIndex(portalDir, index);
          }
        } catch { /* non-fatal */ }

        clearIndexCache(portalId);

        // Update search index (non-blocking)
        const type = path.extname(contentPath).toLowerCase() === '.json' ? 'json' : 'md';
        searchStore.indexDocument(portalId, contentPath, content, type)
          .catch(err => console.error('[search] Index update failed:', err.message));

        res.json({ ok: true, path: contentPath, pageId });
      } catch (err) {
        console.error(`[api] Content update failed for ${portalId}/${contentPath}:`, err);
        res.status(500).json({ error: 'Failed to update content', code: 'UPDATE_FAILED' });
      }
    });
  }

  // DELETE /api/portals/:id/content/* — delete content file (admin-only)
  if (isAdminEnabled) {
    router.delete('/:id/content/*', requireAdmin, async (req, res) => {
      const portalId = req.params.id;
      if (!isValidPortalId(portalId)) {
        return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
      }

      const contentPath = req.params[0];
      if (!isValidContentPath(contentPath)) {
        return res.status(400).json({ error: 'Invalid content path', code: 'INVALID_PATH' });
      }

      const filePath = path.join(portalsDir, portalId, contentPath);
      const resolvedPath = path.resolve(filePath);
      const portalRoot = path.resolve(path.join(portalsDir, portalId));
      if (!resolvedPath.startsWith(portalRoot + path.sep) && resolvedPath !== portalRoot) {
        return res.status(400).json({ error: 'Invalid path', code: 'INVALID_PATH' });
      }

      try {
        // Delete the file
        await fsp.unlink(filePath);

        // Remove from content-index
        const portalDir = path.join(portalsDir, portalId);
        try {
          const index = await readIndex(portalDir);
          if (index) {
            // Find and remove page by path
            for (let i = 0; i < index.sections.length; i++) {
              const section = index.sections[i];
              if (section.isRootFile && section.path === contentPath) {
                index.sections.splice(i, 1);
                break;
              }
              if (section.pages) {
                const pageIdx = section.pages.findIndex(p => p.path === contentPath);
                if (pageIdx !== -1) {
                  section.pages.splice(pageIdx, 1);
                  break;
                }
              }
            }
            await writeIndex(portalDir, index);
          }
        } catch { /* non-fatal */ }

        clearIndexCache(portalId);

        // Remove from search index (non-blocking)
        searchStore.removeDocument(portalId, contentPath);

        res.json({ ok: true });
      } catch (err) {
        if (err.code === 'ENOENT') {
          return res.status(404).json({ error: 'Content not found', code: 'CONTENT_NOT_FOUND' });
        }
        console.error(`[api] Content deletion failed for ${portalId}/${contentPath}:`, err);
        res.status(500).json({ error: 'Failed to delete content', code: 'DELETE_FAILED' });
      }
    });
  }

  // GET /api/portals/:id/content/* — serve content files (markdown/JSON)
  router.get('/:id/content/*', async (req, res) => {
    const portalId = req.params.id;
    if (!isValidPortalId(portalId)) {
      return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
    }

    const contentPath = req.params[0];
    if (!isValidContentPath(contentPath)) {
      return res.status(400).json({ error: 'Invalid content path', code: 'INVALID_PATH' });
    }

    const filePath = path.join(portalsDir, portalId, contentPath);

    // Security: ensure resolved path is still inside the portal directory
    const resolvedPath = path.resolve(filePath);
    const portalRoot = path.resolve(path.join(portalsDir, portalId));
    if (!resolvedPath.startsWith(portalRoot + path.sep) && resolvedPath !== portalRoot) {
      return res.status(400).json({ error: 'Invalid path', code: 'INVALID_PATH' });
    }

    try {
      await fsp.access(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === '.json' ? 'application/json' : 'text/plain';
      res.set('Content-Type', `${contentType}; charset=utf-8`);
      const content = await fsp.readFile(filePath, 'utf-8');
      res.send(content);
    } catch {
      res.status(404).json({ error: 'Content not found', code: 'CONTENT_NOT_FOUND' });
    }
  });

  return router;
}

module.exports = { createContentRouter };
