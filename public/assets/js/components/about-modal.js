/**
 * About Modal Component
 * Displays app-level "About" information from a markdown file in a centered overlay.
 */

const ABOUT_MD_URL = '/assets/content/about.md';
let modalEl = null;
let cachedHtml = null;

export function initAboutModal() {
  document.getElementById('about-btn')?.addEventListener('click', openAboutModal);
}

async function openAboutModal() {
  if (modalEl) return;

  modalEl = document.createElement('div');
  modalEl.className = 'about-overlay';
  modalEl.innerHTML = `
    <div class="about-modal" role="dialog" aria-modal="true" aria-label="About this application">
      <div class="about-modal-header">
        <h2 class="about-modal-title">About</h2>
        <button class="about-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="about-modal-body md-content">
        <div class="loading-spinner"></div>
      </div>
    </div>`;

  document.body.appendChild(modalEl);

  // Close handlers
  modalEl.querySelector('.about-modal-close').addEventListener('click', closeAboutModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeAboutModal();
  });
  document.addEventListener('keydown', onEscapeKey);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modalEl.classList.add('about-overlay--visible');
    });
  });

  // Load and render markdown
  const bodyEl = modalEl.querySelector('.about-modal-body');
  try {
    if (!cachedHtml) {
      const resp = await fetch(ABOUT_MD_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.text();
      cachedHtml = (typeof marked !== 'undefined') ? marked.parse(raw) : `<pre>${raw}</pre>`;
    }
    bodyEl.innerHTML = cachedHtml;

    if (typeof hljs !== 'undefined') {
      bodyEl.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
  } catch {
    bodyEl.innerHTML = `
      <div class="error-message">
        <h3>Unable to load content</h3>
        <p>Could not load the about page. Please try again later.</p>
      </div>`;
  }
}

function closeAboutModal() {
  if (!modalEl) return;
  document.removeEventListener('keydown', onEscapeKey);

  modalEl.classList.remove('about-overlay--visible');
  modalEl.addEventListener('transitionend', () => {
    modalEl.remove();
    modalEl = null;
  }, { once: true });

  // Fallback if transitionend doesn't fire
  setTimeout(() => {
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
  }, 400);
}

function onEscapeKey(e) {
  if (e.key === 'Escape') closeAboutModal();
}
