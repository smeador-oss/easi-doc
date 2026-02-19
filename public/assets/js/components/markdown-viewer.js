/**
 * Markdown Viewer Component
 * Renders markdown content with syntax highlighting, Mermaid diagrams, and auto-generated ToC.
 */
import { loadContent } from '../services/content-loader.js';

let mermaidInitialized = false;

export async function renderMarkdown(portalId, path, contentEl, tocEl, contentIndices) {
  // Show loading
  contentEl.innerHTML = '<div class="loading-spinner"></div>';
  tocEl.innerHTML = '';

  try {
    const raw = await loadContent(portalId, path);
    const html = parseMarkdown(raw);
    contentEl.innerHTML = `<article class="md-content">${html}</article>`;

    // Post-processing
    highlightCode(contentEl);
    await renderMermaidDiagrams(contentEl);
    embedSharePointLists(contentEl);
    rewriteLinks(contentEl, portalId, path, contentIndices);
    buildTableOfContents(contentEl, tocEl);
    addHeadingAnchors(contentEl);

  } catch (err) {
    contentEl.innerHTML = `
      <div class="error-message">
        <h3>Unable to load document</h3>
        <p>Could not load <code>${escapeHtml(path)}</code>. Please ensure the file exists.</p>
      </div>`;
  }
}

function parseMarkdown(raw) {
  if (typeof marked === 'undefined') return `<pre>${escapeHtml(raw)}</pre>`;

  // Configure marked
  marked.setOptions({
    gfm: true,
    breaks: false,
    pedantic: false
  });

  return marked.parse(raw);
}

function highlightCode(container) {
  if (typeof hljs === 'undefined') return;
  container.querySelectorAll('pre code').forEach(block => {
    // Skip mermaid blocks
    if (block.classList.contains('language-mermaid')) return;
    hljs.highlightElement(block);
  });
}

async function renderMermaidDiagrams(container) {
  if (typeof mermaid === 'undefined') return;

  const mermaidBlocks = container.querySelectorAll('code.language-mermaid');
  if (mermaidBlocks.length === 0) return;

  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    mermaidInitialized = true;
  }

  for (const block of mermaidBlocks) {
    const pre = block.parentElement;
    const src = block.textContent;
    const div = document.createElement('div');
    div.className = 'mermaid';

    try {
      const id = 'mermaid-' + Math.random().toString(36).slice(2, 9);
      const { svg } = await mermaid.render(id, src);
      div.innerHTML = svg;
      pre.replaceWith(div);
    } catch {
      // Leave as code block if Mermaid fails
    }
  }
}

function embedSharePointLists(container) {
  const pattern = /^::sharepoint\[(.+)\]$/;
  container.querySelectorAll('p').forEach(p => {
    const match = p.textContent.trim().match(pattern);
    if (!match) return;
    const url = match[1].trim();
    // Only allow SharePoint URLs
    if (!url.includes('.sharepoint.com')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'sharepoint-embed';
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = 'SharePoint List';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
    iframe.setAttribute('loading', 'lazy');
    wrapper.appendChild(iframe);
    p.replaceWith(wrapper);
  });
}

function rewriteLinks(container, portalId, currentPath, contentIndices) {
  const dir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
  container.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;

    // Handle easidoc:// protocol links — resolve UUID to path
    if (href.startsWith('easidoc://')) {
      const uuid = href.replace('easidoc://', '').replace(/^pageId\//, '');
      const resolved = resolveEasidocLink(uuid, portalId, contentIndices);
      if (resolved) {
        a.setAttribute('href', resolved);
      } else {
        // Mark as broken link
        a.setAttribute('href', '#');
        a.classList.add('broken-link');
        a.title = `Broken link: target ${uuid} not found`;
      }
      return;
    }

    // Standard relative link rewriting
    if (!href.startsWith('http') && !href.startsWith('#') && (href.endsWith('.md') || href.endsWith('.json'))) {
      const resolved = href.startsWith('/') ? href.slice(1) : dir + href;
      a.setAttribute('href', `#/${portalId}/${resolved}`);
    }
  });
}

/**
 * Resolve an easidoc:// UUID to a hash route.
 * Searches the current portal first, then all other portals.
 */
function resolveEasidocLink(uuid, currentPortalId, contentIndices) {
  if (!contentIndices || !uuid) return null;

  // Search current portal first, then others
  const portalIds = [currentPortalId, ...Array.from(contentIndices.keys()).filter(id => id !== currentPortalId)];

  for (const pId of portalIds) {
    const index = contentIndices.get(pId);
    if (!index) continue;

    for (const entry of index) {
      // Check if this entry matches (root-level page)
      if (entry.id === uuid && entry.path) {
        return `#/${pId}/${entry.path}`;
      }
      // Check children (pages within sections)
      if (entry.children) {
        for (const child of entry.children) {
          if (child.id === uuid && child.path) {
            return `#/${pId}/${child.path}`;
          }
        }
      }
    }
  }

  return null;
}

function buildTableOfContents(contentEl, tocEl) {
  const headings = contentEl.querySelectorAll('h2, h3');
  if (headings.length === 0) {
    tocEl.innerHTML = '';
    return;
  }

  let html = '';
  headings.forEach(h => {
    const id = slugify(h.textContent);
    h.id = id;
    const level = h.tagName === 'H3' ? '3' : '2';
    html += `<li><a class="toc-link" data-level="${level}" data-target="${id}">${escapeHtml(h.textContent)}</a></li>`;
  });

  tocEl.innerHTML = html;

  // Click handlers for ToC links (scroll within main, don't change URL hash)
  tocEl.querySelectorAll('.toc-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.getElementById(link.getAttribute('data-target'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Intersection observer for active ToC highlighting
  setupTocObserver(contentEl, tocEl);
}

function setupTocObserver(contentEl, tocEl) {
  const headings = contentEl.querySelectorAll('h2[id], h3[id]');
  if (headings.length === 0) return;

  const mainEl = document.getElementById('main-content');
  if (!mainEl) return;

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          tocEl.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
          const link = tocEl.querySelector(`.toc-link[data-target="${entry.target.id}"]`);
          if (link) link.classList.add('active');
          break;
        }
      }
    },
    { root: mainEl, rootMargin: '0px 0px -70% 0px', threshold: 0.1 }
  );

  headings.forEach(h => observer.observe(h));
}

function addHeadingAnchors(container) {
  container.querySelectorAll('h2[id], h3[id], h4[id]').forEach(h => {
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = 'javascript:void(0)';
    anchor.textContent = '#';
    anchor.style.cssText = 'opacity:0;margin-left:0.3em;text-decoration:none;color:var(--text-muted);transition:opacity 0.15s';
    anchor.addEventListener('click', e => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    h.style.position = 'relative';
    h.appendChild(anchor);
    h.addEventListener('mouseenter', () => anchor.style.opacity = '1');
    h.addEventListener('mouseleave', () => anchor.style.opacity = '0');
  });
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
