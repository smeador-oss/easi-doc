/**
 * Shared Validation Helpers
 * Used across route modules for portal ID, content path, and name formatting.
 */
const path = require('path');

// Allowed file extensions for content serving
const ALLOWED_EXTENSIONS = new Set(['.md', '.json']);

// Validate portal ID: lowercase alphanumeric + hyphens only
function isValidPortalId(id) {
  return /^[a-z0-9][a-z0-9-]*$/.test(id);
}

// Validate content path: no traversal, no absolute paths
function isValidContentPath(p) {
  if (!p || p.includes('..') || path.isAbsolute(p)) return false;
  const ext = path.extname(p).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

function humanize(name) {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

module.exports = { ALLOWED_EXTENSIONS, isValidPortalId, isValidContentPath, humanize };
