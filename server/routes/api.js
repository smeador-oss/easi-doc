/**
 * API Router Assembler
 * Loads config, resolves auth mode, and mounts route modules.
 */
const express = require('express');
const fs = require('fs');
const { createAuthRouter } = require('./auth');
const { createPortalsRouter } = require('./portals');
const { createContentRouter } = require('./content');
const { createSearchRouter } = require('./search');
const adminStore = require('../services/admin-store');

module.exports = function createApiRouter({ portalsDir, configPath }) {
  const router = express.Router();

  // Load config
  let authMode = 'none';
  let authConfig = {};
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    authMode = (cfg.auth?.mode || 'none').toLowerCase();
    authConfig = cfg.auth || {};
  } catch { /* default to none */ }

  const VALID_AUTH_MODES = ['none', 'credentials'];
  if (!VALID_AUTH_MODES.includes(authMode)) {
    if (authMode === 'email') {
      console.warn('[api] Auth mode "email" has been removed. Use "credentials" instead. Falling back to "none".');
    } else {
      console.warn(`[api] Unknown auth mode "${authMode}", falling back to "none"`);
    }
    authMode = 'none';
  }

  console.log(`[api] Auth mode: ${authMode}`);

  // Mount auth routes and resolve middleware
  const auth = createAuthRouter({
    authMode,
    adminStore,
    sessionDays: authConfig.sessionDays || 365,
    passwordMinLength: authConfig.passwordMinLength || 8
  });
  router.use(auth.router);

  // Mount portal routes
  const portalsRouter = createPortalsRouter({
    portalsDir,
    configPath,
    requireAdmin: auth.requireAdmin,
    isAdminEnabled: auth.isAdminEnabled
  });
  router.use('/portals', portalsRouter);

  // Mount content routes (under /portals for path consistency)
  const contentRouter = createContentRouter({
    portalsDir,
    requireAdmin: auth.requireAdmin,
    isAdminEnabled: auth.isAdminEnabled
  });
  router.use('/portals', contentRouter);

  // Mount search routes
  const searchRouter = createSearchRouter();
  router.use('/search', searchRouter);

  return router;
};
