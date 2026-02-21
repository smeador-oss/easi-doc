/**
 * Auth Route Handlers
 * Provides identity, login/logout, setup, and admin management.
 *
 * Auth is pluggable via config.json → auth.mode:
 *   "none"        – open access, no login, admin features always enabled
 *   "credentials" – username/password auth with bcrypt + session cookie
 */
const express = require('express');
const crypto = require('crypto');

// Unique token generated fresh on every server start.
// Embedding it in session cookies means any cookie from a previous
// run is automatically invalidated — users log in again after restart.
const SESSION_NONCE = crypto.randomBytes(16).toString('hex');

// ─── Cookie Parsing ─────────────────────────────────────────

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.substring(0, idx).trim();
      cookies[name] = decodeURIComponent(pair.substring(idx + 1).trim());
    }
  });
  return cookies;
}

// ─── Router Factory ─────────────────────────────────────────

/**
 * Creates the auth router and resolves the active auth strategy.
 * Returns { router, requireAdmin, getUserIdentity, isAdminEnabled, authMode }
 */
function createAuthRouter({ authMode, adminStore, sessionDays = 365, passwordMinLength = 8 }) {
  const router = express.Router();

  // ─── Strategy: none ───────────────────────────────────────

  if (authMode === 'none') {
    const getUserIdentity = () => ({ username: '', displayName: '' });
    const requireAdmin = (req, res, next) => next();

    router.get('/me', (req, res) => {
      res.json({ username: null, isAdmin: true, needsSetup: false, authMode: 'none' });
    });

    router.post('/quit', (req, res) => {
      res.json({ ok: true });
      setTimeout(() => process.exit(0), 500);
    });

    return { router, requireAdmin, getUserIdentity, isAdminEnabled: true, authMode };
  }

  // ─── Strategy: credentials ────────────────────────────────

  const maxAge = sessionDays * 24 * 60 * 60 * 1000;

  function getUserIdentity(req) {
    const cookies = parseCookies(req);
    const raw = (cookies.portal_session || '').trim();
    const [username, nonce] = raw.split('|');
    if (!username || nonce !== SESSION_NONCE) return { username: '', displayName: '' };
    return { username: username.toLowerCase(), displayName: '' };
  }

  function requireAdmin(req, res, next) {
    const { username } = getUserIdentity(req);
    if (!username) {
      return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    return adminStore.isAdmin(username).then(ok => {
      if (!ok) {
        return res.status(403).json({ error: 'Forbidden — not an admin', code: 'FORBIDDEN' });
      }
      // Check mustChangePassword — block everything except password change and logout
      return adminStore.findAdmin(username).then(admin => {
        if (admin && admin.mustChangePassword) {
          const allowedPaths = ['/api/logout', '/api/admins/me/password'];
          const fullPath = req.baseUrl + req.path;
          if (!allowedPaths.includes(fullPath)) {
            return res.status(403).json({
              error: 'Password change required',
              code: 'MUST_CHANGE_PASSWORD',
              mustChangePassword: true
            });
          }
        }
        return next();
      });
    }).catch(() => res.status(500).json({ error: 'Auth check failed', code: 'AUTH_ERROR' }));
  }

  // ─── GET /api/me ──────────────────────────────────────────

  router.get('/me', async (req, res) => {
    try {
      const needsSetup = !(await adminStore.hasAnyAdmins());
      const { username } = getUserIdentity(req);

      if (!username) {
        return res.json({ username: null, displayName: null, isAdmin: false, needsSetup, authMode: 'credentials' });
      }

      const admin = await adminStore.findAdmin(username);
      if (!admin) {
        return res.json({ username: null, displayName: null, isAdmin: false, needsSetup, authMode: 'credentials' });
      }

      res.json({
        username: admin.username,
        displayName: admin.displayName,
        isAdmin: true,
        needsSetup,
        authMode: 'credentials',
        mustChangePassword: admin.mustChangePassword || false
      });
    } catch (err) {
      console.error('[api] /me failed:', err);
      res.status(500).json({ error: 'Identity check failed', code: 'AUTH_ERROR' });
    }
  });

  // ─── POST /api/setup ─────────────────────────────────────

  router.post('/setup', async (req, res) => {
    try {
      const hasAdmins = await adminStore.hasAnyAdmins();
      if (hasAdmins) {
        return res.status(409).json({ error: 'Setup already completed', code: 'ALREADY_SETUP' });
      }

      const { username, displayName, password, confirmPassword } = req.body || {};

      if (!username || !username.trim()) {
        return res.status(400).json({ error: 'Username is required', code: 'MISSING_USERNAME' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Password is required', code: 'MISSING_PASSWORD' });
      }
      if (password.length < passwordMinLength) {
        return res.status(400).json({
          error: `Password must be at least ${passwordMinLength} characters`,
          code: 'PASSWORD_TOO_SHORT'
        });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match', code: 'PASSWORD_MISMATCH' });
      }

      const result = await adminStore.addAdmin(username, displayName, password, false, 'setup');
      if (!result.added) {
        return res.status(409).json({ error: result.reason, code: 'SETUP_FAILED' });
      }

      // Set session cookie (includes nonce so it expires on server restart)
      const sessionUser = username.trim().toLowerCase();
      res.cookie('portal_session', `${sessionUser}|${SESSION_NONCE}`, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] Setup failed:', err);
      res.status(500).json({ error: 'Setup failed', code: 'SETUP_FAILED' });
    }
  });

  // ─── POST /api/login ──────────────────────────────────────

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required', code: 'MISSING_CREDENTIALS' });
      }

      const result = await adminStore.verifyCredentials(username, password);

      if (result.locked) {
        return res.status(423).json({
          error: result.reason,
          code: 'ACCOUNT_LOCKED',
          retryAfter: result.retryAfter
        });
      }

      if (!result.ok) {
        return res.status(401).json({ error: result.reason, code: 'INVALID_CREDENTIALS' });
      }

      // Set session cookie (includes nonce so it expires on server restart)
      res.cookie('portal_session', `${result.admin.username}|${SESSION_NONCE}`, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge
      });

      res.json({
        ok: true,
        username: result.admin.username,
        displayName: result.admin.displayName,
        mustChangePassword: result.admin.mustChangePassword
      });
    } catch (err) {
      console.error('[api] Login failed:', err);
      res.status(500).json({ error: 'Login failed', code: 'LOGIN_FAILED' });
    }
  });

  // ─── POST /api/logout ─────────────────────────────────────

  router.post('/logout', (req, res) => {
    res.clearCookie('portal_session');
    res.json({ ok: true });
  });

  // ─── GET /api/admins ──────────────────────────────────────

  router.get('/admins', requireAdmin, async (req, res) => {
    try {
      const admins = await adminStore.getAdmins();
      res.json({ admins });
    } catch (err) {
      console.error('[api] List admins failed:', err);
      res.status(500).json({ error: 'Failed to list admins', code: 'ADMIN_ERROR' });
    }
  });

  // ─── POST /api/admins ─────────────────────────────────────

  router.post('/admins', requireAdmin, async (req, res) => {
    try {
      const { username, displayName, temporaryPassword } = req.body || {};

      if (!username || !username.trim()) {
        return res.status(400).json({ error: 'Username is required', code: 'MISSING_USERNAME' });
      }
      if (!temporaryPassword) {
        return res.status(400).json({ error: 'Temporary password is required', code: 'MISSING_PASSWORD' });
      }
      if (temporaryPassword.length < passwordMinLength) {
        return res.status(400).json({
          error: `Password must be at least ${passwordMinLength} characters`,
          code: 'PASSWORD_TOO_SHORT'
        });
      }

      const caller = getUserIdentity(req).username || 'unknown';
      const result = await adminStore.addAdmin(username, displayName, temporaryPassword, true, caller);
      if (!result.added) {
        return res.status(409).json({ error: result.reason, code: 'ALREADY_ADMIN' });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] Add admin failed:', err);
      res.status(500).json({ error: 'Failed to add admin', code: 'ADMIN_ERROR' });
    }
  });

  // ─── DELETE /api/admins/:username ─────────────────────────

  router.delete('/admins/:username', requireAdmin, async (req, res) => {
    try {
      const username = decodeURIComponent(req.params.username);
      const result = await adminStore.removeAdmin(username);
      if (!result.removed) {
        return res.status(400).json({ error: result.reason, code: 'REMOVE_FAILED' });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] Remove admin failed:', err);
      res.status(500).json({ error: 'Failed to remove admin', code: 'ADMIN_ERROR' });
    }
  });

  // ─── POST /api/quit ───────────────────────────────────────

  router.post('/quit', requireAdmin, (req, res) => {
    res.json({ ok: true });
    setTimeout(() => process.exit(0), 500);
  });

  // ─── POST /api/admins/me/password ─────────────────────────

  router.post('/admins/me/password', async (req, res) => {
    try {
      const { username } = getUserIdentity(req);
      if (!username) {
        return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
      }

      const { currentPassword, newPassword, confirmNewPassword } = req.body || {};

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required', code: 'MISSING_FIELDS' });
      }
      if (newPassword.length < passwordMinLength) {
        return res.status(400).json({
          error: `Password must be at least ${passwordMinLength} characters`,
          code: 'PASSWORD_TOO_SHORT'
        });
      }
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ error: 'New passwords do not match', code: 'PASSWORD_MISMATCH' });
      }

      // Verify current password
      const verify = await adminStore.verifyCredentials(username, currentPassword);
      if (!verify.ok) {
        return res.status(401).json({ error: 'Current password is incorrect', code: 'INVALID_CREDENTIALS' });
      }

      const result = await adminStore.updatePassword(username, newPassword);
      if (!result.ok) {
        return res.status(400).json({ error: result.reason, code: 'PASSWORD_UPDATE_FAILED' });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('[api] Password change failed:', err);
      res.status(500).json({ error: 'Password change failed', code: 'PASSWORD_CHANGE_FAILED' });
    }
  });

  return { router, requireAdmin, getUserIdentity, isAdminEnabled: true, authMode };
}

module.exports = { createAuthRouter };
