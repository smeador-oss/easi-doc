/**
 * Navigation Tree Component
 * Renders a unified collapsible sidebar tree for ALL portals.
 * Three-level hierarchy: Portal → Section → Page.
 */

// Portal-level icons (SVG path fragments, same as portal-switcher.js)
const PORTAL_ICONS = {
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
};

// Section-level icons (full SVG elements)
const SECTION_ICONS = {
  framework: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  processes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  architecture: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="6" rx="1"/><rect x="1" y="16" width="8" height="6" rx="1"/><rect x="15" y="16" width="8" height="6" rx="1"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="5" y1="13" x2="19" y2="13"/><line x1="5" y1="13" x2="5" y2="16"/><line x1="19" y1="13" x2="19" y2="16"/></svg>',
  'data-catalogue': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>',
  'getting-started': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

const HOME_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';

const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

/**
 * Initialize the unified multi-portal navigation tree.
 * @param {HTMLElement} container - The sidebar DOM element
 * @param {Array} portals - All portals from /api/portals
 * @param {Map} contentIndices - Map<portalId, contentIndexArray>
 * @param {boolean} isAdmin - Whether to show admin add buttons
 */
export function initUnifiedNavTree(container, portals, contentIndices, isAdmin = false) {
  renderUnified(container, portals, contentIndices, isAdmin);

  // Remove previous hashchange listener to prevent duplicates
  if (container._navHashHandler) {
    window.removeEventListener('hashchange', container._navHashHandler);
  }
  container._navHashHandler = () => updateUnifiedActiveState(container, portals);
  window.addEventListener('hashchange', container._navHashHandler);

  updateUnifiedActiveState(container, portals);
}

const KEBAB_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

// Track the currently open dropdown so we can close it
let openDropdown = null;

function closeOpenDropdown() {
  if (openDropdown) {
    openDropdown.remove();
    openDropdown = null;
  }
  document.removeEventListener('click', onDocClickCloseDropdown, true);
}

function onDocClickCloseDropdown(e) {
  if (openDropdown && !openDropdown.contains(e.target)) {
    closeOpenDropdown();
  }
}

/**
 * Show a dropdown menu anchored to a trigger button.
 * @param {HTMLElement} trigger - The "..." button
 * @param {Array<{label:string, action:Function, danger?:boolean}>} items
 */
function showDropdown(trigger, items) {
  closeOpenDropdown();

  const menu = document.createElement('div');
  menu.className = 'nav-dropdown';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'nav-dropdown-item' + (item.danger ? ' nav-dropdown-item--danger' : '');
    btn.textContent = item.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeOpenDropdown();
      item.action();
    });
    menu.appendChild(btn);
  }

  // Position below the trigger
  trigger.style.position = 'relative';
  const parent = trigger.closest('.nav-section-header') || trigger.closest('.nav-portal-header');
  if (parent) parent.style.position = 'relative';
  (parent || trigger).appendChild(menu);

  // Adjust if it overflows the sidebar
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const sidebar = menu.closest('.app-sidebar') || document.body;
    const sidebarRect = sidebar.getBoundingClientRect();
    if (rect.bottom > sidebarRect.bottom) {
      menu.style.top = 'auto';
      menu.style.bottom = '100%';
      menu.style.marginBottom = '4px';
      menu.style.marginTop = '0';
    }
  });

  openDropdown = menu;
  // Delay attaching the global listener so the current click doesn't immediately close it
  setTimeout(() => document.addEventListener('click', onDocClickCloseDropdown, true), 0);
}

function renderUnified(container, portals, contentIndices, isAdmin = false) {
  let html = '<div class="nav-sections">';

  for (const portal of portals) {
    const portalId = portal.id;
    const iconSvg = PORTAL_ICONS[portal.icon] || PORTAL_ICONS.file;
    const sections = contentIndices.get(portalId) || [];

    html += `<div class="nav-portal-group" data-portal="${esc(portalId)}">`;

    // Portal header — clicking navigates to welcome page
    html += `<div class="nav-portal-header-wrap" data-portal="${esc(portalId)}">`;
    html += `<a class="nav-portal-header" href="#/${esc(portalId)}">`;
    html += `<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg></span>`;
    html += `<span class="nav-portal-title">${escHtml(portal.title)}</span>`;
    if (isAdmin) {
      html += `<button class="nav-kebab-btn" data-kebab="portal" data-portal="${esc(portalId)}" title="Portal actions">${KEBAB_ICON}</button>`;
    }
    html += `<span class="nav-chevron">${CHEVRON}</span>`;
    html += `</a>`;
    html += `</div>`;

    // Collapsible children (hidden by default, auto-expanded for active portal)
    html += `<div class="nav-portal-children" style="display:none">`;

    // Home link for this portal
    html += `<div class="nav-section" data-section="home">`;
    html += `<a class="nav-section-header nav-section-link nav-home-link" href="#/${esc(portalId)}" data-portal="${esc(portalId)}" data-path="">`;
    html += `<span class="nav-icon">${HOME_ICON}</span>`;
    html += `<span class="nav-section-title">Home</span>`;
    html += `</a></div>`;

    // Sections from content-index
    for (const section of sections) {
      const key = section.path.replace(/\//g, '').replace(/\..*$/, '');
      const icon = SECTION_ICONS[section.icon] || SECTION_ICONS[key] || SECTION_ICONS.framework;

      // Top-level file (e.g., README.md) — render as direct link
      if (section.type === 'md' || section.type === 'json') {
        html += `<div class="nav-section" data-section="${esc(key)}">`;
        html += `<a class="nav-section-header nav-section-link" href="#/${esc(portalId)}/${esc(section.path)}" data-portal="${esc(portalId)}" data-path="${esc(section.path)}">`;
        html += `<span class="nav-icon">${icon}</span>`;
        html += `<span class="nav-section-title">${escHtml(section.title)}</span>`;
        html += `</a></div>`;
        continue;
      }

      // Folder section with children
      html += `<div class="nav-section" data-section="${esc(key)}">`;
      html += `<div class="nav-section-header" data-portal="${esc(portalId)}" data-path="${esc(section.path)}" data-section-id="${esc(section.id || '')}">`;
      html += `<span class="nav-icon">${icon}</span>`;
      html += `<span class="nav-section-title">${escHtml(section.title)}</span>`;
      if (isAdmin) {
        html += `<button class="nav-kebab-btn" data-kebab="section" data-portal="${esc(portalId)}" data-section-path="${esc(section.path)}" data-section-id="${esc(section.id || '')}" data-section-title="${esc(section.title)}" title="Section actions">${KEBAB_ICON}</button>`;
      }
      if (section.children && section.children.length) {
        html += `<span class="nav-chevron">${CHEVRON}</span>`;
      }
      html += `</div>`;

      if (section.children && section.children.length) {
        html += `<div class="nav-children" style="display:none">`;
        for (const child of section.children) {
          html += `<a class="nav-link" href="#/${esc(portalId)}/${esc(child.path)}" data-portal="${esc(portalId)}" data-path="${esc(child.path)}">${escHtml(child.title)}</a>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }


    html += `</div>`; // .nav-portal-children
    html += `</div>`; // .nav-portal-group
  }

  html += '</div>';
  container.innerHTML = html;

  // --- Click handlers ---

  // Portal header chevrons: toggle expand/collapse without navigating
  container.querySelectorAll('.nav-portal-header').forEach(header => {
    const chevron = header.querySelector('.nav-chevron');
    if (chevron) {
      chevron.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const group = header.closest('.nav-portal-group');
        const children = group.querySelector('.nav-portal-children');
        if (!children) return;
        const isOpen = children.style.display !== 'none';
        children.style.display = isOpen ? 'none' : 'block';
        group.classList.toggle('open', !isOpen);
      });
    }

    // Clicking the header text navigates AND expands (ignore kebab)
    header.addEventListener('click', (e) => {
      if (e.target.closest('.nav-kebab-btn')) return;
      const group = header.closest('.nav-portal-group');
      const children = group.querySelector('.nav-portal-children');
      if (children) {
        children.style.display = 'block';
        group.classList.add('open');
      }
    });
  });

  // Section headers: toggle children (ignore kebab clicks)
  container.querySelectorAll('.nav-section-header:not(.nav-section-link)').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.nav-kebab-btn')) return;
      const section = header.closest('.nav-section');
      const children = section.querySelector('.nav-children');
      if (!children) return;
      const isOpen = children.style.display !== 'none';
      children.style.display = isOpen ? 'none' : 'block';
      section.classList.toggle('open', !isOpen);
    });
  });

  // Admin: wire up kebab menu buttons
  if (isAdmin) {
    container.querySelectorAll('.nav-kebab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        const kind = btn.dataset.kebab;
        const portalId = btn.dataset.portal;

        if (kind === 'portal') {
          showDropdown(btn, [
            { label: 'Edit portal', action: () => window.__app?.openEditPortalDialog(portalId) },
            { label: 'Delete portal', danger: true, action: () => window.__app?.openDeletePortalDialog(portalId) }
          ]);
        } else if (kind === 'section') {
          const sectionId = btn.dataset.sectionId;
          const sectionTitle = btn.dataset.sectionTitle;
          const sectionPath = btn.dataset.sectionPath;
          showDropdown(btn, [
            { label: 'Add page', action: () => window.__app?.openAddPageDialog(portalId, sectionPath) },
            { label: 'Rename section', action: () => window.__app?.openRenameSectionDialog(portalId, sectionId, sectionTitle) },
            { label: 'Delete section', danger: true, action: () => window.__app?.deleteSection(portalId, sectionId, sectionTitle) }
          ]);
        }
      });
    });
  }

  // Inject styles (once)
  injectStyles();
}

function updateUnifiedActiveState(container, portals) {
  const hash = (window.location.hash || '').replace(/^#\/?/, '');

  // Parse portalId and contentPath from hash
  let portalId = null;
  let contentPath = '';

  if (hash) {
    const slashIdx = hash.indexOf('/');
    if (slashIdx === -1) {
      portalId = hash;
      contentPath = '';
    } else {
      portalId = hash.substring(0, slashIdx);
      contentPath = hash.substring(slashIdx + 1);
    }
    // Validate that portalId actually matches a known portal
    if (!portals.some(p => p.id === portalId)) {
      portalId = null;
      contentPath = '';
    }
  }

  // Clear all active states
  container.querySelectorAll('.active').forEach(el => el.classList.remove('active'));

  // Auto-expand the active portal group (don't collapse others — user may have opened them)
  if (portalId) {
    const activeGroup = container.querySelector(`.nav-portal-group[data-portal="${portalId}"]`);
    if (activeGroup) {
      const children = activeGroup.querySelector('.nav-portal-children');
      if (children) {
        children.style.display = 'block';
        activeGroup.classList.add('open');
      }
    }
  }

  // No portal active (dashboard) — just clear highlights, nothing to expand
  if (!portalId) return;

  // Highlight the correct item
  if (!contentPath || contentPath === '') {
    // On portal welcome — highlight that portal's Home link
    const homeLink = container.querySelector(`.nav-portal-group[data-portal="${portalId}"] .nav-home-link`);
    if (homeLink) homeLink.classList.add('active');
    return;
  }

  // Check page links within this portal
  const link = container.querySelector(`.nav-portal-group[data-portal="${portalId}"] .nav-link[data-path="${contentPath}"]`);
  if (link) {
    link.classList.add('active');
    // Expand parent section
    const section = link.closest('.nav-section');
    const children = section?.querySelector('.nav-children');
    if (children) {
      children.style.display = 'block';
      section.classList.add('open');
    }
    return;
  }

  // Check section headers (root-level files, etc.)
  const sectionHeader = container.querySelector(`.nav-portal-group[data-portal="${portalId}"] .nav-section-header[data-path="${contentPath}"]`);
  if (sectionHeader) {
    sectionHeader.classList.add('active');
  }
}

function injectStyles() {
  if (document.getElementById('nav-tree-styles')) return;

  const style = document.createElement('style');
  style.id = 'nav-tree-styles';
  style.textContent = `
    .nav-sections { padding: 0 var(--space-2); }

    /* --- Portal group level --- */
    .nav-portal-group { margin-bottom: var(--space-1); }

    .nav-portal-group + .nav-portal-group {
      border-top: 1px solid var(--border-color-light);
      padding-top: var(--space-1);
    }

    .nav-portal-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--border-radius);
      cursor: pointer;
      user-select: none;
      transition: background var(--transition-fast);
      text-decoration: none;
      color: var(--text-primary);
    }

    .nav-portal-header:hover { background: var(--nav-hover-bg); }

    .nav-portal-title {
      font-family: var(--font-base); font-weight: 600;
      font-size: var(--text-sm);
      flex: 1;
    }

    .nav-portal-header .nav-chevron {
      transition: transform var(--transition-fast);
    }

    .nav-portal-group.open > .nav-portal-header-wrap .nav-chevron,
    .nav-portal-group.open > .nav-portal-header .nav-chevron {
      transform: rotate(90deg);
    }

    .nav-portal-children {
      padding-left: var(--space-2);
    }

    /* --- Section level --- */
    .nav-section { margin-bottom: var(--space-1); }

    .nav-section-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--border-radius);
      cursor: pointer;
      user-select: none;
      transition: background var(--transition-fast);
      text-decoration: none;
      color: var(--text-primary);
    }

    .nav-section-header:hover { background: var(--nav-hover-bg); }

    .nav-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: var(--color-primary-dark);
      display: flex;
      align-items: center;
    }
    .nav-icon svg { width: 100%; height: 100%; }

    .nav-section-title {
      font-family: var(--font-base); font-weight: 600;
      font-size: var(--text-sm);
      flex: 1;
    }

    .nav-chevron {
      width: 14px;
      height: 14px;
      color: var(--text-muted);
      transition: transform var(--transition-fast);
      display: flex;
      align-items: center;
    }
    .nav-chevron svg { width: 100%; height: 100%; }

    .nav-section.open > .nav-section-header .nav-chevron {
      transform: rotate(90deg);
    }

    .nav-children {
      padding: var(--space-1) 0 var(--space-1) calc(var(--space-3) + 18px + var(--space-3));
    }

    /* --- Page links --- */
    .nav-link {
      display: block;
      padding: var(--space-1) var(--space-3);
      font-size: var(--text-sm);
      color: var(--text-secondary);
      text-decoration: none;
      border-radius: var(--border-radius);
      transition: all var(--transition-fast);
      margin-bottom: 1px;
    }

    .nav-link:hover {
      color: var(--text-primary);
      background: var(--nav-hover-bg);
    }

    .nav-link.active {
      background: var(--nav-active-bg);
      color: var(--nav-active-text);
      font-family: var(--font-base); font-weight: 600;
    }

    .nav-section-header.active {
      background: var(--nav-active-bg);
      color: var(--nav-active-text);
    }
    .nav-section-header.active .nav-icon { color: var(--nav-active-text); }
    .nav-section-header.active .nav-section-title { color: var(--nav-active-text); }

    /* --- Admin kebab menu --- */
    .nav-kebab-btn {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      border-radius: 4px;
      color: var(--text-muted);
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      transition: background var(--transition-fast), color var(--transition-fast);
    }
    .nav-kebab-btn svg { width: 14px; height: 14px; }
    .nav-kebab-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
    .nav-section-header:hover .nav-kebab-btn,
    .nav-portal-header:hover .nav-kebab-btn { display: flex; }

    .nav-dropdown {
      position: absolute;
      right: 0;
      top: 100%;
      margin-top: 4px;
      z-index: 1000;
      min-width: 160px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: 0 4px 16px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.15);
      padding: 4px 0;
    }
    .nav-dropdown-item {
      display: block;
      width: 100%;
      padding: 8px 14px;
      text-align: left;
      font-size: var(--text-sm);
      font-family: var(--font-base);
      color: var(--text-primary);
      background: none;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--transition-fast);
    }
    .nav-dropdown-item:hover { background: var(--bg-surface-hover); }
    .nav-dropdown-item--danger { color: var(--color-error, #e53e3e); }
    .nav-dropdown-item--danger:hover { background: rgba(229,62,62,0.08); }
  `;
  document.head.appendChild(style);
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
