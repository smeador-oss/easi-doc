/**
 * easi-doc – Main Application Orchestrator
 * Handles multi-portal routing, branding, auth-aware admin UI, and content dispatch.
 */
import { initUnifiedNavTree } from './components/nav-tree.js';
import { initPortalSwitcher } from './components/portal-switcher.js';
import { renderMarkdown } from './components/markdown-viewer.js';
import { renderCatalogue } from './components/json-catalogue.js';
import { loadJSON, clearCache } from './services/content-loader.js';
import { initAboutModal } from './components/about-modal.js';
import { openAdminModal } from './components/admin-modal.js';
import { initTheme, toggleTheme } from './services/theme-manager.js';
import { openPageEditor, openJsonEditor, closePageEditor } from './components/page-editor.js';
import { initSearchBar } from './components/search-bar.js';
import { initDropZone } from './components/drop-zone.js';

class App {
  constructor() {
    this.config = null;
    this.contentEl = document.getElementById('content-area');
    this.tocEl = document.getElementById('toc-list');
    this.sidebarEl = document.getElementById('sidebar');
    this.portalNavEl = document.getElementById('portal-nav');
    this.currentPortalId = null;
    this.defaultPortal = null;
    this.portals = [];
    this.contentIndices = new Map();
    this.isAdmin = false;
    this.username = null;
    this.displayName = null;
    this.authMode = 'none';
  }

  async init() {
    // 1. Initialize UI
    initTheme();
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    initAboutModal();
    const searchBarEl = document.getElementById('search-bar');
    if (searchBarEl) initSearchBar(searchBarEl);

    // 2. Check identity and admin status
    try {
      const me = await fetchJSON('/api/me');
      this.isAdmin = me.isAdmin;
      this.username = me.username || null;
      this.displayName = me.displayName || null;
      this.authMode = me.authMode || 'none';

      if (me.needsSetup) {
        this.showSetupScreen();
        return; // Stop init — setup must complete first
      }

      // Handle forced password change
      if (me.mustChangePassword) {
        this.showChangePasswordDialog(true);
        return;
      }
    } catch {
      // /api/me failed — proceed as non-admin
      this.isAdmin = false;
    }

    // In credentials auth mode: offer sign-in link if not authenticated
    if (this.authMode === 'credentials' && !this.isAdmin && !this.username) {
      this.injectSignInLink();
    }

    await this.initApp();
  }

  async initApp() {
    // Inject admin header button if admin
    if (this.isAdmin && this.authMode === 'credentials') {
      this.injectAdminHeaderButton();
    }

    // Discover portals
    try {
      const data = await loadJSON('/api/portals');
      this.portals = data.portals || [];
      this.defaultPortal = this.portals[0]?.id || 'data-catalog';
    } catch {
      this.portals = [];
      this.defaultPortal = 'data-catalog';
    }

    // Pre-fetch all content indices and build unified sidebar
    await this.fetchAllContentIndices();
    initUnifiedNavTree(this.sidebarEl, this.portals, this.contentIndices, this.isAdmin);

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', () => this.refresh());

    // Set up routing
    window.addEventListener('hashchange', () => this.route());
    this.route();

    // Initialize drag-and-drop upload zone
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      initDropZone({
        targetEl: mainEl,
        getContext: () => ({
          isAdmin: this.isAdmin,
          portals: this.portals,
          contentIndices: this.contentIndices,
          currentPortalId: this.currentPortalId
        }),
        onComplete: () => {
          clearCache();
          this.refresh();
        }
      });
    }
  }

  // ─── Setup Screen (credentials auth) ────────────────────────

  showSetupScreen() {
    document.body.classList.add('dashboard-view');
    this.contentEl.innerHTML = `
      <div class="setup-screen">
        <div class="setup-card">
          <img src="assets/images/easi-doc-logo.svg" alt="easi-doc" class="header-logo">
          <h2>Welcome</h2>
          <p>Set up your admin account to get started. You'll be able to create portals, add content, and manage other admins.</p>
          <form class="admin-form" id="setup-form" autocomplete="off">
            <div class="admin-field">
              <label class="admin-label">Username <span class="admin-field-req">*</span></label>
              <input type="text" name="username" class="admin-input" placeholder="admin" required autocomplete="username">
            </div>
            <div class="admin-field">
              <label class="admin-label">Display Name</label>
              <input type="text" name="displayName" class="admin-input" placeholder="Your name">
            </div>
            <div class="admin-field">
              <label class="admin-label">Password <span class="admin-field-req">*</span></label>
              <input type="password" name="password" class="admin-input" placeholder="Minimum 8 characters" required autocomplete="new-password">
            </div>
            <div class="admin-field">
              <label class="admin-label">Confirm Password <span class="admin-field-req">*</span></label>
              <input type="password" name="confirmPassword" class="admin-input" placeholder="Re-enter password" required autocomplete="new-password">
            </div>
            <div class="admin-form-error" hidden></div>
            <div class="admin-form-actions" style="justify-content:center">
              <button type="submit" class="admin-btn admin-btn--primary">Get Started</button>
            </div>
          </form>
        </div>
      </div>`;

    const form = this.contentEl.querySelector('#setup-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = form.querySelector('[name="username"]').value.trim();
      const displayName = form.querySelector('[name="displayName"]').value.trim();
      const password = form.querySelector('[name="password"]').value;
      const confirmPassword = form.querySelector('[name="confirmPassword"]').value;
      const errorEl = form.querySelector('.admin-form-error');
      const btn = form.querySelector('[type="submit"]');

      if (!username) {
        errorEl.textContent = 'Username is required.';
        errorEl.hidden = false;
        return;
      }
      if (password.length < 8) {
        errorEl.textContent = 'Password must be at least 8 characters.';
        errorEl.hidden = false;
        return;
      }
      if (password !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.hidden = false;
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Setting up...';

      try {
        const resp = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, displayName, password, confirmPassword })
        });
        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data.error || 'Setup failed');
        }
        // Setup complete — reload as admin
        this.isAdmin = true;
        this.username = username.toLowerCase();
        this.displayName = displayName || username;
        document.body.classList.remove('dashboard-view');
        clearCache();
        await this.initApp();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Get Started';
      }
    });
  }

  // ─── Admin Header Button ─────────────────────────────────────

  injectAdminHeaderButton() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || headerRight.querySelector('#admin-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'admin-btn';
    btn.className = 'admin-header-btn';
    btn.title = 'Manage Admins';
    btn.setAttribute('aria-label', 'Manage Admins');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    // Insert before the about button
    const aboutBtn = headerRight.querySelector('#about-btn');
    if (aboutBtn) {
      headerRight.insertBefore(btn, aboutBtn);
    } else {
      headerRight.prepend(btn);
    }

    btn.addEventListener('click', () => this.openAdminPanel());
  }

  // ─── Admin Sign In (credentials auth) ──────────────────────

  injectSignInLink() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || headerRight.querySelector('#signin-link')) return;

    const link = document.createElement('button');
    link.id = 'signin-link';
    link.className = 'admin-header-btn';
    link.title = 'Admin Sign In';
    link.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
    link.style.opacity = '0.5';
    headerRight.prepend(link);

    link.addEventListener('click', () => this.showSignInDialog());
  }

  showSignInDialog() {
    openAdminModal({
      title: 'Admin Sign In',
      fields: [
        { name: 'username', label: 'Username', type: 'text', required: true, placeholder: 'admin' },
        { name: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Password' }
      ],
      submitLabel: 'Sign In',
      onSubmit: async (data) => {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: data.username, password: data.password })
        });
        if (!resp.ok) {
          const err = await resp.json();
          if (err.code === 'ACCOUNT_LOCKED') {
            const mins = Math.ceil((err.retryAfter || 300) / 60);
            throw new Error(`Account temporarily locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
          }
          throw new Error(err.error || 'Sign in failed');
        }
        window.location.reload();
      }
    });
  }

  // ─── Change Password Dialog ───────────────────────────────

  showChangePasswordDialog(forced = false) {
    const title = forced ? 'Change Your Password' : 'Change Password';
    const hint = forced ? 'You must change your temporary password before continuing.' : '';

    if (forced) {
      document.body.classList.add('dashboard-view');
    }

    openAdminModal({
      title,
      fields: [
        ...(hint ? [{ name: '_hint', label: '', type: 'hint', hint }] : []),
        { name: 'currentPassword', label: 'Current Password', type: 'password', required: true, placeholder: 'Enter current password' },
        { name: 'newPassword', label: 'New Password', type: 'password', required: true, placeholder: 'Minimum 8 characters' },
        { name: 'confirmNewPassword', label: 'Confirm New Password', type: 'password', required: true, placeholder: 'Re-enter new password' }
      ],
      submitLabel: 'Update Password',
      allowClose: !forced,
      onSubmit: async (data) => {
        if (data.newPassword.length < 8) {
          throw new Error('New password must be at least 8 characters.');
        }
        if (data.newPassword !== data.confirmNewPassword) {
          throw new Error('New passwords do not match.');
        }
        const resp = await fetch('/api/admins/me/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
            confirmNewPassword: data.confirmNewPassword
          })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Password change failed');
        }
        if (forced) {
          // Password changed — reload to proceed with normal init
          window.location.reload();
        }
      }
    });
  }

  // ─── Admin Management Panel ──────────────────────────────────

  async openAdminPanel() {
    let admins = [];
    try {
      const data = await fetchJSON('/api/admins');
      admins = data.admins || [];
    } catch { /* empty list fallback */ }

    const overlay = document.createElement('div');
    overlay.className = 'admin-overlay';
    overlay.innerHTML = `
      <div class="admin-modal" role="dialog" aria-modal="true" aria-label="Admin Panel">
        <div class="admin-modal-header">
          <h2 class="admin-modal-title">Admin Panel</h2>
          <button class="admin-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="admin-modal-body">
          <div class="admin-section">
            <div class="admin-section-header">
              <h3>Signed in as</h3>
            </div>
            <div class="admin-current-user">
              <span class="admin-current-name">${escapeHtml(this.displayName || this.username || '')}</span>
              <span class="admin-current-username">@${escapeHtml(this.username || '')}</span>
              <div class="admin-current-actions">
                <button class="admin-btn admin-btn--secondary" id="admin-change-pw-btn">Change Password</button>
                <button class="admin-btn admin-btn--secondary" id="admin-logout-btn">Sign Out</button>
              </div>
            </div>
          </div>
          <div class="admin-section">
            <div class="admin-section-header">
              <h3>Admin Users</h3>
            </div>
            <ul class="admin-list" id="admin-panel-list"></ul>
            <form class="admin-form" id="admin-add-form" autocomplete="off" style="border-top: 1px solid var(--border-color); padding-top: var(--space-4)">
              <div class="admin-field">
                <label class="admin-label">Add Admin</label>
                <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
                  <input type="text" name="username" class="admin-input" placeholder="Username" style="flex:1;min-width:120px" required>
                  <input type="text" name="displayName" class="admin-input" placeholder="Display Name" style="flex:1;min-width:120px">
                  <input type="password" name="temporaryPassword" class="admin-input" placeholder="Temp Password" style="flex:1;min-width:120px" required>
                  <button type="submit" class="admin-btn admin-btn--primary" style="white-space:nowrap">Add</button>
                </div>
                <span class="admin-field-hint">New admin must change their password on first sign in.</span>
              </div>
              <div class="admin-form-error" hidden></div>
            </form>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => {
      document.removeEventListener('keydown', escHandler);
      overlay.classList.remove('admin-overlay--visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      setTimeout(() => overlay.isConnected && overlay.remove(), 400);
    };

    const escHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);

    overlay.querySelector('.admin-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Change password button
    overlay.querySelector('#admin-change-pw-btn').addEventListener('click', () => {
      close();
      this.showChangePasswordDialog(false);
    });

    // Sign out button
    overlay.querySelector('#admin-logout-btn').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.reload();
    });

    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('admin-overlay--visible')));

    const renderList = (list) => {
      const ul = overlay.querySelector('#admin-panel-list');
      if (list.length === 0) {
        ul.innerHTML = '<li class="admin-list-item" style="justify-content:center;color:var(--text-tertiary)">No admins yet.</li>';
        return;
      }
      ul.innerHTML = list.map(a => `
        <li class="admin-list-item">
          <div class="admin-list-info">
            <span class="admin-list-email">${escapeHtml(a.displayName || a.username)}</span>
            <span class="admin-list-meta">@${escapeHtml(a.username)}${a.mustChangePassword ? ' · Must change password' : ''} · Added ${a.addedBy === 'setup' ? 'during setup' : 'by ' + escapeHtml(a.addedBy)}</span>
          </div>
          <button class="admin-list-remove" data-username="${escapeAttr(a.username)}" title="Remove admin">&times;</button>
        </li>`).join('');

      ul.querySelectorAll('.admin-list-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          const username = btn.dataset.username;
          if (!confirm(`Remove @${username} as admin?`)) return;
          try {
            const resp = await fetch(`/api/admins/${encodeURIComponent(username)}`, { method: 'DELETE' });
            if (!resp.ok) {
              const data = await resp.json();
              alert(data.error || 'Failed to remove admin');
              return;
            }
            list = list.filter(a => a.username.toLowerCase() !== username.toLowerCase());
            renderList(list);
          } catch { alert('Failed to remove admin'); }
        });
      });
    };

    renderList(admins);

    // Add admin form
    const addForm = overlay.querySelector('#admin-add-form');
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = addForm.querySelector('[name="username"]').value.trim();
      const displayName = addForm.querySelector('[name="displayName"]').value.trim();
      const temporaryPassword = addForm.querySelector('[name="temporaryPassword"]').value;
      const errorEl = addForm.querySelector('.admin-form-error');

      if (!username || !temporaryPassword) return;

      try {
        const resp = await fetch('/api/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, displayName, temporaryPassword })
        });
        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data.error || 'Failed to add admin');
        }
        errorEl.hidden = true;
        admins.push({ username: username.toLowerCase(), displayName: displayName || username, mustChangePassword: true, addedBy: this.username || 'admin', addedAt: new Date().toISOString() });
        renderList(admins);
        addForm.querySelector('[name="username"]').value = '';
        addForm.querySelector('[name="displayName"]').value = '';
        addForm.querySelector('[name="temporaryPassword"]').value = '';
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });
  }

  // ─── Sidebar & Navigation ────────────────────────────────────

  async fetchAllContentIndices() {
    const results = await Promise.all(this.portals.map(async (p) => {
      try {
        return [p.id, await loadJSON(`/api/portals/${p.id}/content-index`)];
      } catch {
        return [p.id, []];
      }
    }));
    this.contentIndices = new Map(results);
  }

  async refresh() {
    const btn = document.getElementById('refresh-btn');
    if (btn) {
      btn.classList.add('spinning');
      btn.disabled = true;
    }

    // Clear client cache
    clearCache();

    // Tell server to clear cache for current portal
    if (this.currentPortalId) {
      try {
        await fetch(`/api/portals/${this.currentPortalId}/refresh`, { method: 'POST' });
      } catch { /* ignore */ }
    }

    // Re-discover portals (picks up newly added/removed portals)
    try {
      const data = await loadJSON('/api/portals');
      this.portals = data.portals || [];
      this.defaultPortal = this.portals[0]?.id || 'data-catalog';
    } catch { /* keep existing list */ }

    // Rebuild unified sidebar with fresh data
    await this.fetchAllContentIndices();
    initUnifiedNavTree(this.sidebarEl, this.portals, this.contentIndices, this.isAdmin);

    // Reload current view
    if (this.currentPortalId) {
      await this.switchPortal(this.currentPortalId, true);
    } else {
      // On the dashboard — re-render it
      await this.showDashboard();
    }

    if (btn) {
      setTimeout(() => { btn.classList.remove('spinning'); btn.disabled = false; }, 400);
    }
  }

  async switchPortal(portalId, forceReload = false) {
    if (!portalId) portalId = this.defaultPortal;

    // Skip if already on this portal (unless forced)
    if (this.currentPortalId === portalId && !forceReload) return;
    this.currentPortalId = portalId;

    // Exit dashboard view — restore sidebar
    document.body.classList.remove('dashboard-view');

    // Load portal-specific config
    try {
      this.config = await loadJSON(`/api/portals/${portalId}/config`);
    } catch {
      this.config = { name: 'easi-doc', subtitle: 'Simple Documentation Portal' };
    }
    this.applyBranding();

    // Header home link: dashboard if multi-portal, portal welcome if single
    const homeLink = document.getElementById('header-home-link');
    if (homeLink) homeLink.href = (this.portals.length > 1 || this.isAdmin) ? '#/' : `#/${portalId}`;

    // Update portal switcher tabs
    initPortalSwitcher(this.portalNavEl, this.portals, portalId, { isAdmin: this.isAdmin });
    this.portalNavEl?.querySelector('#header-new-portal-btn')?.addEventListener('click', () => this.openNewPortalDialog());
  }

  applyBranding() {
    if (!this.config) return;

    if (this.config.name) {
      if (this.portals.length > 1) {
        document.title = `${this.config.name} – easi-doc`;
      } else {
        document.title = `${this.config.name} – ${this.config.subtitle || ''}`;
        const titleEl = document.getElementById('header-title');
        if (titleEl) {
          titleEl.innerHTML = `${escapeHtml(this.config.name)} <span>${escapeHtml(this.config.subtitle || '')}</span>`;
        }
      }
    }
    if (this.config.logo) {
      const logo = document.getElementById('header-logo');
      if (logo) logo.src = this.config.logo;
    }
  }

  route() {
    const hash = (window.location.hash || '').replace(/^#\/?/, '');

    this.tocEl.innerHTML = '';

    const slashIdx = hash.indexOf('/');
    let portalId, contentPath;

    if (!hash || hash === '') {
      if (this.portals.length > 1 || this.isAdmin) {
        this.showDashboard();
        return;
      }
      portalId = this.defaultPortal;
      contentPath = '';
    } else if (slashIdx === -1) {
      portalId = hash;
      contentPath = '';
    } else {
      portalId = hash.substring(0, slashIdx);
      contentPath = hash.substring(slashIdx + 1);
    }

    if (portalId !== this.currentPortalId) {
      this.switchPortal(portalId).then(() => this.dispatchContent(contentPath));
      return;
    }

    this.dispatchContent(contentPath);
  }

  async dispatchContent(contentPath) {
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;

    if (!contentPath || contentPath === '') {
      this.renderWelcome();
    } else if (contentPath.endsWith('.json')) {
      renderCatalogue(this.currentPortalId, contentPath, this.contentEl, this.tocEl, this.isAdmin);
      if (this.isAdmin) this.injectPageActions(contentPath);
    } else if (contentPath.endsWith('.md')) {
      await renderMarkdown(this.currentPortalId, contentPath, this.contentEl, this.tocEl, this.contentIndices);
      if (this.isAdmin) this.injectPageActions(contentPath);
    } else {
      this.renderWelcome();
    }
  }

  injectPageActions(contentPath) {
    // Find page title from content-index
    const index = this.contentIndices.get(this.currentPortalId) || [];
    let title = contentPath;
    for (const section of index) {
      if (section.path === contentPath) { title = section.title; break; }
      if (section.children) {
        const page = section.children.find(c => c.path === contentPath);
        if (page) { title = page.title; break; }
      }
    }

    const wrap = document.createElement('div');
    wrap.className = 'page-kebab-wrap';
    wrap.innerHTML = `
      <button class="page-kebab-btn" title="Page actions">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
      </button>
    `;

    const btn = wrap.querySelector('.page-kebab-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close existing dropdown if any
      const existing = wrap.querySelector('.page-kebab-dropdown');
      if (existing) { existing.remove(); return; }

      const menu = document.createElement('div');
      menu.className = 'page-kebab-dropdown';
      menu.innerHTML = `
        <button class="page-kebab-item" data-action="edit">Edit page</button>
        <button class="page-kebab-item page-kebab-item--danger" data-action="delete">Delete page</button>
      `;
      menu.querySelector('[data-action="edit"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.remove();
        this.editPage(this.currentPortalId, contentPath, title);
      });
      menu.querySelector('[data-action="delete"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.remove();
        this.deletePage(this.currentPortalId, contentPath, title);
      });
      wrap.appendChild(menu);

      // Close on outside click
      const closeHandler = (evt) => {
        if (!menu.contains(evt.target)) {
          menu.remove();
          document.removeEventListener('click', closeHandler, true);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
    });

    this.contentEl.prepend(wrap);
  }

  // ─── Dashboard (multi-portal landing) ─────────────────────────

  async showDashboard() {
    this.currentPortalId = null;
    document.body.classList.add('dashboard-view');
    this.tocEl.innerHTML = '';

    document.title = 'easi-doc – Simple Documentation Portal';
    const titleEl = document.getElementById('header-title');
    if (titleEl) titleEl.innerHTML = 'easi-doc <span>Simple Documentation Portal</span>';

    const homeLink = document.getElementById('header-home-link');
    if (homeLink) homeLink.href = '#/';

    // Show portal tabs with none highlighted
    initPortalSwitcher(this.portalNavEl, this.portals, null, { isAdmin: this.isAdmin });
    this.portalNavEl?.querySelector('#header-new-portal-btn')?.addEventListener('click', () => this.openNewPortalDialog());

    const portalDetails = await Promise.all(this.portals.map(async (p) => {
      try {
        const sections = await loadJSON(`/api/portals/${p.id}/content-index`);
        return { ...p, sections: sections.filter(s => s.type === 'folder') };
      } catch {
        return { ...p, sections: [] };
      }
    }));

    this.renderDashboard(portalDetails);
  }

  renderDashboard(portalDetails) {
    const portalIcons = {
      database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
      chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
      layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    };

    const cardsHtml = portalDetails.map(p => {
      const iconSvg = portalIcons[p.icon] || portalIcons.file;
      const sectionsHtml = p.sections.length > 0
        ? `<ul class="dashboard-card-sections">${p.sections.map(s =>
            `<li>${escapeHtml(s.title)}</li>`
          ).join('')}</ul>`
        : '';

      const adminActions = this.isAdmin
        ? `<div class="dashboard-card-actions">
            <button class="dashboard-card-edit" data-portal-id="${escapeAttr(p.id)}" title="Edit portal">Edit</button>
            <button class="dashboard-card-delete" data-portal-id="${escapeAttr(p.id)}" title="Delete portal">Delete</button>
          </div>`
        : '';

      return `<div class="dashboard-card-wrap">
        <a class="dashboard-card" href="#/${escapeAttr(p.id)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${iconSvg}</svg>
          <div class="dashboard-card-title">${escapeHtml(p.title)}</div>
          <div class="dashboard-card-subtitle">${escapeHtml(p.subtitle)}</div>
          ${sectionsHtml}
        </a>
        ${adminActions}
      </div>`;
    }).join('');

    const newPortalBtn = this.isAdmin
      ? `<button class="admin-btn admin-btn--primary" id="new-portal-btn" style="margin-bottom:var(--space-4)">+ New Portal</button>`
      : '';

    this.contentEl.innerHTML = `
      <div class="welcome-page dashboard-page">
        <h1 class="welcome-title">AI-Accelerated Development</h1>
        <p class="welcome-subtitle">Select a portal to get started.</p>
        ${newPortalBtn}
        <div class="dashboard-cards">${cardsHtml}</div>
      </div>`;

    if (this.isAdmin) {
      this.contentEl.querySelector('#new-portal-btn')?.addEventListener('click', () => this.openNewPortalDialog());
      this.contentEl.querySelectorAll('.dashboard-card-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEditPortalDialog(btn.dataset.portalId);
        });
      });
      this.contentEl.querySelectorAll('.dashboard-card-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDeletePortalDialog(btn.dataset.portalId);
        });
      });
    }
  }

  // ─── Welcome Page (V1-style cards) ─────────────────────────

  renderWelcome() {
    const welcome = this.config?.welcome;
    const title = welcome?.title || this.config?.subtitle || 'Documentation Portal';
    const subtitle = welcome?.subtitle || 'Select a topic from the sidebar to get started.';
    let cards = welcome?.cards || [];

    // Auto-generate cards from content index sections if none configured
    if (cards.length === 0 && this.currentPortalId) {
      const sections = this.contentIndices.get(this.currentPortalId) || [];
      cards = sections.filter(s => s.children && s.children.length > 0).map(s => {
        const firstPage = s.children[0];
        return {
          title: s.title,
          description: `${s.children.length} ${s.children.length === 1 ? 'page' : 'pages'}`,
          icon: 'file',
          link: firstPage.path
        };
      });
    }

    // Icon SVG map for welcome cards
    const cardIcons = {
      grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
      pulse: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
      architecture: '<rect x="4" y="2" width="16" height="6" rx="1"/><rect x="1" y="16" width="8" height="6" rx="1"/><rect x="15" y="16" width="8" height="6" rx="1"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="5" y1="13" x2="19" y2="13"/><line x1="5" y1="13" x2="5" y2="16"/><line x1="19" y1="13" x2="19" y2="16"/>',
      database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
      chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
    };

    let cardsHtml = '';
    if (cards.length > 0) {
      cardsHtml = cards.map(card => {
        const iconSvg = cardIcons[card.icon] || cardIcons.file;
        return `<a class="welcome-card" href="#/${escapeAttr(this.currentPortalId)}/${escapeAttr(card.link)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${iconSvg}</svg>
          <div class="welcome-card-title">${escapeHtml(card.title)}</div>
          <div class="welcome-card-desc">${escapeHtml(card.description)}</div>
        </a>`;
      }).join('');
    }

    this.contentEl.innerHTML = `
      <div class="welcome-page">
        <h1 class="welcome-title">${escapeHtml(title)}</h1>
        <p class="welcome-subtitle">${escapeHtml(subtitle)}</p>
        ${cardsHtml ? `<div class="welcome-cards">${cardsHtml}</div>` : ''}
      </div>`;
  }

  // ─── Create New Portal Dialog ────────────────────────────────

  openNewPortalDialog() {
    openAdminModal({
      title: 'Create New Portal',
      fields: [
        { name: 'title', label: 'Portal Name', type: 'text', required: true, placeholder: 'e.g. Data Catalog' },
        { name: 'subtitle', label: 'Description', type: 'text', placeholder: 'Short description' },
        { name: 'icon', label: 'Icon', type: 'select', value: 'book', options: [
          { value: 'database', label: 'Database' },
          { value: 'book', label: 'Book' },
          { value: 'chart', label: 'Chart' },
          { value: 'settings', label: 'Settings' },
          { value: 'users', label: 'Users' },
          { value: 'globe', label: 'Globe' },
          { value: 'file', label: 'File' },
          { value: 'layers', label: 'Layers' }
        ]},
        { name: 'sections', label: 'Sections', type: 'text', placeholder: 'guides, reference, data-catalogue', hint: 'Comma-separated folder names. A starter page is created in each.' }
      ],
      submitLabel: 'Create Portal',
      onSubmit: async (data) => {
        const id = data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!id) throw new Error('Portal name must contain letters or numbers.');

        const resp = await fetch('/api/portals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            title: data.title,
            subtitle: data.subtitle,
            icon: data.icon,
            sections: data.sections
          })
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to create portal');
        }

        clearCache();
        await this.refresh();
        window.location.hash = `#/${id}`;
      }
    });
  }

  // ─── Add Markdown Page Dialog ────────────────────────────────

  openAddPageDialog(portalId, sectionPath) {
    openAdminModal({
      title: 'Add Page',
      fields: [
        { name: 'title', label: 'Page Title', type: 'text', required: true, placeholder: 'e.g. Getting Started' },
        { name: 'content', label: 'Paste Markdown', type: 'textarea', placeholder: 'Paste your markdown content here, or leave empty and upload a file below.', rows: 10 },
        { name: 'file', label: 'Or Upload .md File', type: 'file', accept: '.md' }
      ],
      submitLabel: 'Add Page',
      onSubmit: async (data) => {
        if (!data.title) throw new Error('Title is required.');

        let mdContent = '';
        if (data.file) {
          mdContent = await readFileAsText(data.file);
        } else if (data.content) {
          mdContent = data.content;
        }

        // Prepend a heading if the content doesn't already start with one
        if (!mdContent.trimStart().startsWith('#')) {
          mdContent = `# ${data.title}\n\n${mdContent}`;
        }

        const slug = data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const filePath = `${sectionPath}/${slug}.md`;

        const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}/content/${filePath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: mdContent
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to add page');
        }

        clearCache();
        await this.refresh();
        window.location.hash = `#/${portalId}/${filePath}`;
      }
    });
  }

  // ─── Add JSON Table Dialog ───────────────────────────────────

  openAddTableDialog(portalId) {
    openAdminModal({
      title: 'Add Table',
      fields: [
        { name: 'name', label: 'Table Name', type: 'text', required: true, placeholder: 'e.g. brz_sap_work_order', hint: 'Used as the filename. Lowercase + underscores recommended.' },
        { name: 'layer', label: 'Layer', type: 'select', value: 'Bronze Layer', options: [
          { value: 'Bronze Layer', label: 'Bronze Layer' },
          { value: 'Silver Layer', label: 'Silver Layer' },
          { value: 'Warehouse Layer', label: 'Warehouse Layer' }
        ]},
        { name: 'file', label: 'Upload JSON File', type: 'file', accept: '.json', required: true }
      ],
      submitLabel: 'Add Table',
      onSubmit: async (data) => {
        if (!data.file) throw new Error('A JSON file is required.');

        const raw = await readFileAsText(data.file);
        let json;
        try {
          json = JSON.parse(raw);
        } catch {
          throw new Error('File is not valid JSON.');
        }

        if (!json.layer) json.layer = data.layer;

        const slug = data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
        const filePath = `data-catalogue/${slug}.json`;

        const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}/content/${filePath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json, null, 2)
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to add table');
        }

        clearCache();
        await this.refresh();
        window.location.hash = `#/${portalId}/${filePath}`;
      }
    });
  }
  // ─── Edit Portal Dialog ──────────────────────────────────────

  openEditPortalDialog(portalId) {
    const portal = this.portals.find(p => p.id === portalId);
    if (!portal) return;

    openAdminModal({
      title: 'Edit Portal',
      fields: [
        { name: 'title', label: 'Portal Name', type: 'text', required: true, value: portal.title },
        { name: 'subtitle', label: 'Description', type: 'text', value: portal.subtitle || '' },
        { name: 'icon', label: 'Icon', type: 'select', value: portal.icon || 'book', options: [
          { value: 'database', label: 'Database' },
          { value: 'book', label: 'Book' },
          { value: 'chart', label: 'Chart' },
          { value: 'settings', label: 'Settings' },
          { value: 'users', label: 'Users' },
          { value: 'globe', label: 'Globe' },
          { value: 'file', label: 'File' },
          { value: 'layers', label: 'Layers' }
        ]},
        { name: 'order', label: 'Sort Order', type: 'text', value: String(portal.order || 999), hint: 'Lower numbers appear first.' }
      ],
      submitLabel: 'Save Changes',
      onSubmit: async (data) => {
        const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            subtitle: data.subtitle,
            icon: data.icon,
            order: parseInt(data.order, 10) || 999
          })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to update portal');
        }
        clearCache();
        await this.refresh();
      }
    });
  }

  // ─── Delete Portal Dialog ───────────────────────────────────

  openDeletePortalDialog(portalId) {
    const portal = this.portals.find(p => p.id === portalId);
    if (!portal) return;

    openAdminModal({
      title: 'Delete Portal',
      fields: [
        { name: '_warn', type: 'hint', hint: `This will permanently delete "${portal.title}" and all its content. This action cannot be undone.` },
        { name: 'confirm', label: 'Type the portal ID to confirm', type: 'text', required: true, placeholder: portalId, hint: `Type "${portalId}" exactly to confirm deletion.` }
      ],
      submitLabel: 'Delete Portal',
      onSubmit: async (data) => {
        if (data.confirm !== portalId) {
          throw new Error(`Type "${portalId}" to confirm deletion.`);
        }
        const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: portalId })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to delete portal');
        }
        clearCache();
        window.location.hash = '#/';
        await this.refresh();
      }
    });
  }

  // ─── Rename Section Dialog ──────────────────────────────────

  openRenameSectionDialog(portalId, sectionId, currentTitle) {
    openAdminModal({
      title: 'Rename Section',
      fields: [
        { name: 'title', label: 'Section Title', type: 'text', required: true, value: currentTitle }
      ],
      submitLabel: 'Rename',
      onSubmit: async (data) => {
        const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}/sections/${encodeURIComponent(sectionId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: data.title })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to rename section');
        }
        clearCache();
        await this.refresh();
      }
    });
  }

  // ─── Delete Section ─────────────────────────────────────────

  async deleteSection(portalId, sectionId, sectionTitle) {
    if (!confirm(`Delete section "${sectionTitle}" and all its pages? This cannot be undone.`)) return;

    try {
      const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}/sections/${encodeURIComponent(sectionId)}`, {
        method: 'DELETE'
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.error || 'Failed to delete section');
        return;
      }
      clearCache();
      await this.refresh();
    } catch {
      alert('Failed to delete section');
    }
  }

  // ─── Edit Page (opens split-pane editor) ────────────────────

  async editPage(portalId, contentPath, title) {
    const { loadContent } = await import('./services/content-loader.js');
    let content;
    try {
      content = await loadContent(portalId, contentPath);
    } catch {
      alert('Failed to load page content.');
      return;
    }

    if (contentPath.endsWith('.json')) {
      openJsonEditor({
        portalId,
        contentPath,
        title,
        content,
        containerEl: this.contentEl,
        onSave: async (newContent) => {
          const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}/content/${contentPath}`, {
            method: 'PUT',
            headers: { 'Content-Type': contentPath.endsWith('.json') ? 'application/json' : 'text/plain' },
            body: newContent
          });
          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Failed to save');
          }
          clearCache();
          await this.refresh();
          this.route();
        },
        onCancel: () => this.route()
      });
    } else {
      openPageEditor({
        portalId,
        contentPath,
        title,
        content,
        containerEl: this.contentEl,
        onSave: async (newContent) => {
          const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}/content/${contentPath}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'text/plain' },
            body: newContent
          });
          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Failed to save');
          }
          clearCache();
          await this.refresh();
          this.route();
        },
        onCancel: () => this.route()
      });
    }
  }

  // ─── Delete Page ────────────────────────────────────────────

  async deletePage(portalId, contentPath, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    try {
      const resp = await fetch(`/api/portals/${encodeURIComponent(portalId)}/content/${contentPath}`, {
        method: 'DELETE'
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.error || 'Failed to delete page');
        return;
      }
      clearCache();
      window.location.hash = `#/${portalId}`;
      await this.refresh();
    } catch {
      alert('Failed to delete page');
    }
  }
}

// ─── Utility Functions ───────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function fetchJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Bootstrap
const app = new App();
app.init().catch(err => console.error('[app] Failed to initialize:', err));

// Expose for components that need admin actions (nav-tree add buttons, catalogue add table)
window.__app = app;
