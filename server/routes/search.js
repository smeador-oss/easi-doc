/**
 * Search Router
 * Provides GET /api/search endpoint for full-text search.
 */
const express = require('express');
const searchStore = require('../services/search-store');

function createSearchRouter() {
  const router = express.Router();

  // GET /api/search?q=<query>&portal=<portalId>&limit=<n>
  router.get('/', (req, res) => {
    const query = (req.query.q || '').trim();
    if (!query) return res.json({ results: [] });
    if (query.length > 200) return res.status(400).json({ error: 'Query too long' });

    const portalId = req.query.portal || null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const results = searchStore.search(query, { portalId, limit });
    res.json({ results });
  });

  return router;
}

module.exports = { createSearchRouter };
