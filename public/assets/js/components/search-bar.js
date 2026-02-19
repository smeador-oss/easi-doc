/**
 * Search Bar Component
 * Real-time search with debounced API calls, keyboard navigation, and dropdown results.
 */

const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function initSearchBar(containerEl) {
  containerEl.innerHTML = `
    <div class="search-bar-inner">
      <span class="search-icon">${SEARCH_ICON}</span>
      <input class="search-input" type="text" placeholder="Search docs..." aria-label="Search documentation" autocomplete="off">
      <kbd class="search-kbd">Ctrl+K</kbd>
    </div>
    <div class="search-dropdown" role="listbox" aria-label="Search results"></div>
  `;

  const input = containerEl.querySelector('.search-input');
  const dropdown = containerEl.querySelector('.search-dropdown');
  const kbd = containerEl.querySelector('.search-kbd');

  let debounceTimer = null;
  let results = [];
  let activeIndex = -1;

  // ─── Input Handler (debounced search) ───────────────────

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();

    if (query.length < MIN_QUERY_LENGTH) {
      hideDropdown();
      return;
    }

    debounceTimer = setTimeout(() => executeSearch(query), DEBOUNCE_MS);
  });

  // ─── Keyboard Navigation ────────────────────────────────

  input.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('visible')) {
      if (e.key === 'Escape') {
        input.blur();
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, results.length - 1);
        updateActiveResult();
        break;

      case 'ArrowUp':
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActiveResult();
        break;

      case 'Enter':
        e.preventDefault();
        navigateToResult(activeIndex);
        break;

      case 'Escape':
        hideDropdown();
        input.blur();
        break;
    }
  });

  // ─── Focus / Blur ───────────────────────────────────────

  input.addEventListener('focus', () => {
    if (kbd) kbd.style.display = 'none';
    // Re-show results if input has content
    if (results.length > 0 && input.value.trim().length >= MIN_QUERY_LENGTH) {
      dropdown.classList.add('visible');
    }
  });

  input.addEventListener('blur', () => {
    if (kbd && !input.value) kbd.style.display = '';
    // Delay hide so click on result can fire first
    setTimeout(() => {
      if (!containerEl.contains(document.activeElement)) {
        hideDropdown();
      }
    }, 200);
  });

  // ─── Global Shortcut: Ctrl+K or / ──────────────────────

  document.addEventListener('keydown', (e) => {
    // Ctrl+K
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }

    // / key (when not typing in an input/textarea)
    if (e.key === '/' && !isTypingInInput(e.target)) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  // ─── Click outside to close ─────────────────────────────

  document.addEventListener('click', (e) => {
    if (!containerEl.contains(e.target)) {
      hideDropdown();
    }
  });

  // ─── Search Execution ───────────────────────────────────

  async function executeSearch(query) {
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`);
      if (!resp.ok) return;
      const data = await resp.json();
      results = data.results || [];
      activeIndex = -1;
      renderDropdown();
    } catch {
      // Network error — silently fail
    }
  }

  // ─── Dropdown Rendering ─────────────────────────────────

  function renderDropdown() {
    if (results.length === 0) {
      dropdown.innerHTML = '<div class="search-empty">No results found</div>';
      dropdown.classList.add('visible');
      return;
    }

    dropdown.innerHTML = results.map((r, i) => {
      const meta = [r.portalTitle, r.sectionTitle].filter(Boolean).join(' / ');
      return `
        <a class="search-result${i === activeIndex ? ' search-result--active' : ''}"
           href="#/${esc(r.portalId)}/${esc(r.contentPath)}"
           data-index="${i}" role="option">
          <div class="search-result-title">${escHtml(r.pageTitle)}</div>
          ${meta ? `<div class="search-result-meta">${escHtml(meta)}</div>` : ''}
          ${r.snippet ? `<div class="search-result-snippet">${r.snippet}</div>` : ''}
        </a>`;
    }).join('');

    dropdown.classList.add('visible');

    // Wire click handlers on results
    dropdown.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(el.dataset.index);
        navigateToResult(idx);
      });
    });
  }

  function updateActiveResult() {
    dropdown.querySelectorAll('.search-result').forEach((el, i) => {
      el.classList.toggle('search-result--active', i === activeIndex);
    });
    // Scroll active result into view
    const active = dropdown.querySelector('.search-result--active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  // ─── Navigation ─────────────────────────────────────────

  function navigateToResult(index) {
    if (index < 0 || index >= results.length) return;
    const r = results[index];
    window.location.hash = `#/${r.portalId}/${r.contentPath}`;
    hideDropdown();
    input.value = '';
    input.blur();
  }

  // ─── Helpers ────────────────────────────────────────────

  function hideDropdown() {
    dropdown.classList.remove('visible');
    activeIndex = -1;
  }

  function isTypingInInput(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
  }
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
