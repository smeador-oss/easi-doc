/**
 * Portal Route Handlers
 * Portal discovery, creation, content-index, config, and cache refresh.
 */
const express = require('express');
const path = require('path');
const fsp = require('fs/promises');
const { discoverPortals, clearCache: clearPortalCache } = require('../services/portal-discovery');
const { generateContentIndex, clearCache: clearIndexCache } = require('../services/content-indexer');
const { readIndex, writeIndex, migrateOrCreateIndex, toApiShape, addSection: addSectionToIndex, removeSection: removeSectionFromIndex } = require('../services/content-index-store');
const { isValidPortalId, humanize } = require('../utils/validation');
const searchStore = require('../services/search-store');

/**
 * Creates the portals router.
 * @param {Object} opts
 * @param {string} opts.portalsDir - Absolute path to the portals/ directory
 * @param {string} opts.configPath - Absolute path to config.json
 * @param {Function} opts.requireAdmin - Admin middleware from auth module
 * @param {boolean} opts.isAdminEnabled - Whether admin features are active
 */
function createPortalsRouter({ portalsDir, configPath, requireAdmin, isAdminEnabled }) {
  const router = express.Router();

  // GET /api/portals — list all discovered portals
  router.get('/', async (req, res) => {
    try {
      const portals = await discoverPortals(portalsDir);
      res.json({ portals });
    } catch (err) {
      console.error('[api] Portal discovery failed:', err);
      res.status(500).json({ error: 'Portal discovery failed', code: 'DISCOVERY_FAILED' });
    }
  });

  // POST /api/portals — create a new portal (admin-only)
  if (isAdminEnabled) {
    router.post('/', requireAdmin, async (req, res) => {
      try {
        const { id, title, subtitle, icon, order, sections } = req.body || {};
        if (!id || !isValidPortalId(id)) {
          return res.status(400).json({ error: 'Invalid portal ID (lowercase alphanumeric + hyphens)', code: 'INVALID_PORTAL_ID' });
        }
        if (!title || !title.trim()) {
          return res.status(400).json({ error: 'Title is required', code: 'MISSING_TITLE' });
        }

        const portalDir = path.join(portalsDir, id);
        try {
          await fsp.access(portalDir);
          return res.status(409).json({ error: 'Portal already exists', code: 'PORTAL_EXISTS' });
        } catch { /* good — doesn't exist yet */ }

        // Parse sections from comma-separated string or array
        let sectionList = [];
        if (Array.isArray(sections)) {
          sectionList = sections.map(s => s.trim()).filter(Boolean);
        } else if (typeof sections === 'string' && sections.trim()) {
          sectionList = sections.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Build portal.json
        const portalJson = {
          title: title.trim(),
          subtitle: (subtitle || '').trim(),
          icon: icon || 'book',
          order: typeof order === 'number' ? order : 999,
          welcome: {
            title: title.trim(),
            subtitle: (subtitle || 'Select a topic from the sidebar.').trim(),
            cards: sectionList.map(s => {
              const slug = s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              return {
                title: humanize(s),
                description: '',
                icon: 'file',
                link: `${slug}/overview.md`
              };
            })
          }
        };

        // Create directory structure
        await fsp.mkdir(portalDir, { recursive: true });
        await fsp.writeFile(path.join(portalDir, 'portal.json'), JSON.stringify(portalJson, null, 2), 'utf-8');

        // Create section folders with starter overview.md
        for (const s of sectionList) {
          const slug = s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const sectionDir = path.join(portalDir, slug);
          await fsp.mkdir(sectionDir, { recursive: true });
          await fsp.writeFile(
            path.join(sectionDir, 'overview.md'),
            `# ${humanize(s)}\n\nAdd your content here.\n`,
            'utf-8'
          );
        }

        // Generate content-index.json for the new portal
        await migrateOrCreateIndex(portalDir, id);

        clearPortalCache();
        res.json({ ok: true, portalId: id });
      } catch (err) {
        console.error('[api] Portal creation failed:', err);
        res.status(500).json({ error: 'Failed to create portal', code: 'CREATE_FAILED' });
      }
    });
  }

  // GET /api/portals/:id/content-index — persisted navigation manifest with UUIDs
  router.get('/:id/content-index', async (req, res) => {
    const portalId = req.params.id;
    if (!isValidPortalId(portalId)) {
      return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
    }

    const portalDir = path.join(portalsDir, portalId);
    try {
      await fsp.access(portalDir);
    } catch {
      return res.status(404).json({ error: 'Portal not found', code: 'PORTAL_NOT_FOUND' });
    }

    try {
      // Try persisted index first, fall back to migration/creation
      let index = await readIndex(portalDir);
      if (!index) {
        index = await migrateOrCreateIndex(portalDir, portalId);
      }
      // Return in legacy API shape for backward compatibility
      res.json(toApiShape(index));
    } catch (err) {
      console.error(`[api] Content index failed for ${portalId}:`, err);
      res.status(500).json({ error: 'Index generation failed', code: 'INDEX_GENERATION_FAILED' });
    }
  });

  // GET /api/portals/:id/config — merged global + per-portal config
  router.get('/:id/config', async (req, res) => {
    const portalId = req.params.id;
    if (!isValidPortalId(portalId)) {
      return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
    }

    // Load global config
    let globalConfig = {};
    try {
      globalConfig = JSON.parse(await fsp.readFile(configPath, 'utf-8'));
    } catch { /* use empty defaults */ }

    // Load portal.json
    let portalConfig = {};
    const portalJsonPath = path.join(portalsDir, portalId, 'portal.json');
    try {
      portalConfig = JSON.parse(await fsp.readFile(portalJsonPath, 'utf-8'));
    } catch {
      return res.status(404).json({ error: 'Portal not found', code: 'PORTAL_NOT_FOUND' });
    }

    // Merge: global as base, portal overrides
    const merged = {
      name: portalConfig.title || globalConfig.name || 'easi-doc',
      subtitle: portalConfig.subtitle || globalConfig.subtitle || '',
      logo: globalConfig.logo || 'assets/images/easi-doc-logo.svg',
      colors: portalConfig.colors || globalConfig.colors || {},
      welcome: portalConfig.welcome || null
    };

    res.json(merged);
  });

  // ─── CRUD: Portal Edit/Delete ───────────────────────────────

  if (isAdminEnabled) {
    // PATCH /api/portals/:id — update portal metadata
    router.patch('/:id', requireAdmin, async (req, res) => {
      const portalId = req.params.id;
      if (!isValidPortalId(portalId)) {
        return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
      }

      const portalDir = path.join(portalsDir, portalId);
      const portalJsonPath = path.join(portalDir, 'portal.json');

      try {
        const portalConfig = JSON.parse(await fsp.readFile(portalJsonPath, 'utf-8'));
        const { title, subtitle, icon, order } = req.body || {};

        if (title !== undefined) portalConfig.title = title.trim();
        if (subtitle !== undefined) portalConfig.subtitle = subtitle.trim();
        if (icon !== undefined) portalConfig.icon = icon;
        if (order !== undefined) portalConfig.order = typeof order === 'number' ? order : portalConfig.order;

        // Update welcome title to match
        if (title !== undefined && portalConfig.welcome) {
          portalConfig.welcome.title = title.trim();
        }

        await fsp.writeFile(portalJsonPath, JSON.stringify(portalConfig, null, 2), 'utf-8');
        clearPortalCache();
        res.json({ ok: true });
      } catch (err) {
        console.error(`[api] Portal update failed for ${portalId}:`, err);
        res.status(500).json({ error: 'Failed to update portal', code: 'UPDATE_FAILED' });
      }
    });

    // DELETE /api/portals/:id — delete entire portal
    router.delete('/:id', requireAdmin, async (req, res) => {
      const portalId = req.params.id;
      if (!isValidPortalId(portalId)) {
        return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
      }

      // Require confirmation: body must contain { confirm: portalId }
      const { confirm } = req.body || {};
      if (confirm !== portalId) {
        return res.status(400).json({ error: 'Confirmation required — send { confirm: portalId }', code: 'CONFIRMATION_REQUIRED' });
      }

      const portalDir = path.join(portalsDir, portalId);
      try {
        await fsp.rm(portalDir, { recursive: true, force: true });
        clearPortalCache();
        clearIndexCache(portalId);
        searchStore.removePortal(portalId);
        res.json({ ok: true });
      } catch (err) {
        console.error(`[api] Portal deletion failed for ${portalId}:`, err);
        res.status(500).json({ error: 'Failed to delete portal', code: 'DELETE_FAILED' });
      }
    });

    // PATCH /api/portals/:id/sections/:sectionId — rename a section
    router.patch('/:id/sections/:sectionId', requireAdmin, async (req, res) => {
      const portalId = req.params.id;
      const sectionId = req.params.sectionId;
      if (!isValidPortalId(portalId)) {
        return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
      }

      const { title } = req.body || {};
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required', code: 'MISSING_TITLE' });
      }

      const portalDir = path.join(portalsDir, portalId);
      try {
        const index = await readIndex(portalDir);
        if (!index) {
          return res.status(404).json({ error: 'Content index not found', code: 'INDEX_NOT_FOUND' });
        }

        const section = index.sections.find(s => s.id === sectionId);
        if (!section) {
          return res.status(404).json({ error: 'Section not found', code: 'SECTION_NOT_FOUND' });
        }

        section.title = title.trim();
        await writeIndex(portalDir, index);
        clearIndexCache(portalId);
        res.json({ ok: true });
      } catch (err) {
        console.error(`[api] Section rename failed:`, err);
        res.status(500).json({ error: 'Failed to rename section', code: 'RENAME_FAILED' });
      }
    });

    // DELETE /api/portals/:id/sections/:sectionId — delete a section and its files
    router.delete('/:id/sections/:sectionId', requireAdmin, async (req, res) => {
      const portalId = req.params.id;
      const sectionId = req.params.sectionId;
      if (!isValidPortalId(portalId)) {
        return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
      }

      const portalDir = path.join(portalsDir, portalId);
      try {
        const result = await removeSectionFromIndex(portalDir, sectionId);
        if (!result.removed) {
          return res.status(404).json({ error: result.reason, code: 'SECTION_NOT_FOUND' });
        }

        // Delete the section folder from disk
        if (result.path) {
          const sectionDir = path.join(portalDir, result.path);
          try { await fsp.rm(sectionDir, { recursive: true, force: true }); } catch { /* ok */ }
        }

        // Remove section pages from search index
        if (result.pages) {
          for (const page of result.pages) {
            searchStore.removeDocument(portalId, page.path);
          }
        }

        clearIndexCache(portalId);
        res.json({ ok: true });
      } catch (err) {
        console.error(`[api] Section deletion failed:`, err);
        res.status(500).json({ error: 'Failed to delete section', code: 'DELETE_FAILED' });
      }
    });
  }

  // POST /api/portals/:id/refresh — clear cache and regenerate persisted index
  const refreshHandler = async (req, res) => {
    const portalId = req.params.id;
    if (!isValidPortalId(portalId)) {
      return res.status(400).json({ error: 'Invalid portal ID', code: 'INVALID_PORTAL_ID' });
    }
    const portalDir = path.join(portalsDir, portalId);
    clearPortalCache();
    clearIndexCache(portalId);

    // Delete existing index so migrateOrCreateIndex regenerates from filesystem
    try { await fsp.unlink(path.join(portalDir, 'content-index.json')); } catch { /* ok */ }
    try { await migrateOrCreateIndex(portalDir, portalId); } catch { /* ok */ }

    // Re-index portal for search
    searchStore.reindexPortal(portalId)
      .catch(err => console.error('[search] Reindex failed:', err.message));

    res.json({ ok: true });
  };

  if (isAdminEnabled) {
    router.post('/:id/refresh', requireAdmin, refreshHandler);
  } else {
    router.post('/:id/refresh', refreshHandler);
  }

  return router;
}

module.exports = { createPortalsRouter };
