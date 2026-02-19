/**
 * Theme Manager Service
 * Handles dark/light theme toggling with localStorage persistence.
 */
const STORAGE_KEY = 'easi-doc-theme';

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme, false);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next, true);
}

function applyTheme(theme, animate) {
  if (animate) {
    document.body.classList.add('theme-transitioning');
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 350);
  }

  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);

  // Toggle highlight.js theme stylesheets (works for both <link> and <style>)
  const lightSheet = document.getElementById('hljs-theme-light');
  const darkSheet = document.getElementById('hljs-theme-dark');
  if (lightSheet && darkSheet) {
    if (lightSheet.tagName === 'LINK') {
      lightSheet.disabled = theme === 'dark';
      darkSheet.disabled = theme === 'light';
    } else {
      // Inline <style> tags: toggle via media attribute
      lightSheet.media = theme === 'dark' ? 'not all' : '';
      darkSheet.media = theme === 'light' ? 'not all' : '';
    }
  }

  // Toggle sun/moon icons
  const sun = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');
  if (sun && moon) {
    sun.style.display = theme === 'light' ? 'block' : 'none';
    moon.style.display = theme === 'dark' ? 'block' : 'none';
  }
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}
