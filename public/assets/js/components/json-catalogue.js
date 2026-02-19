/**
 * JSON Catalogue Explorer Component
 * Renders structured, explorable views of data catalogue JSON files.
 */
import { loadPortalJSON } from '../services/content-loader.js';

export async function renderCatalogue(portalId, path, contentEl, tocEl, isAdmin = false) {
  contentEl.innerHTML = '<div class="loading-spinner"></div>';
  tocEl.innerHTML = '';

  try {
    const data = await loadPortalJSON(portalId, path);
    contentEl.innerHTML = buildCatalogueView(data, path, isAdmin);
    attachCatalogueEvents(contentEl, portalId, isAdmin);
    buildCatalogueToc(data, tocEl);
  } catch (err) {
    contentEl.innerHTML = `
      <div class="error-message">
        <h3>Unable to load catalogue</h3>
        <p>Could not parse <code>${escapeHtml(path)}</code>. Ensure it is valid JSON.</p>
      </div>`;
  }
}

function buildCatalogueView(data, path, isAdmin = false) {
  const layerName = data.layer || extractLayerName(path);
  const description = data.description || '';
  const tables = data.tables || data.datasets || data.entities || [];

  // Count stats
  const tableCount = tables.length;
  const columnCount = tables.reduce((sum, t) => sum + (t.columns || t.fields || t.attributes || []).length, 0);
  const domainSet = new Set(tables.map(t => t.domain || t.schema || 'Default').filter(Boolean));

  let html = '';

  // Header
  html += `<div class="catalogue-header">`;
  html += `<h1 class="catalogue-title">${escapeHtml(layerName)}</h1>`;
  html += `<div class="catalogue-controls">`;
  html += `<input type="text" class="catalogue-search" placeholder="Filter tables..." data-action="search">`;
  html += `<button class="catalogue-btn" data-action="expand-all">Expand All</button>`;
  html += `<button class="catalogue-btn" data-action="collapse-all">Collapse All</button>`;
  html += `<button class="catalogue-btn" data-action="toggle-raw">View Raw JSON</button>`;
  if (isAdmin) {
    html += `<button class="catalogue-btn" data-action="add-table" style="margin-left:auto">+ Add Table</button>`;
  }
  html += `</div></div>`;

  // Description
  if (description) {
    html += `<p style="color:var(--text-secondary);margin-bottom:var(--space-6)">${escapeHtml(description)}</p>`;
  }

  // Summary cards
  html += `<div class="catalogue-summary">`;
  html += summaryCard(tableCount, tableCount === 1 ? 'Table' : 'Tables');
  html += summaryCard(columnCount, 'Columns');
  html += summaryCard(domainSet.size, domainSet.size === 1 ? 'Domain' : 'Domains');
  html += `</div>`;

  // Table cards
  html += `<div class="catalogue-tables" data-role="tables-container">`;
  for (const table of tables) {
    html += buildTableCard(table);
  }
  html += `</div>`;

  // Raw JSON (hidden by default)
  html += `<div class="raw-json-view" data-role="raw-json">`;
  html += `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  html += `</div>`;

  return html;
}

function summaryCard(value, label) {
  return `<div class="summary-card"><div class="summary-card-value">${value}</div><div class="summary-card-label">${label}</div></div>`;
}

function buildTableCard(table) {
  const name = table.name || table.table_name || 'Unnamed';
  const desc = table.description || '';
  const columns = table.columns || table.fields || table.attributes || [];
  const domain = table.domain || table.schema || '';

  let html = `<div class="table-card" data-table-name="${escapeHtml(name.toLowerCase())}">`;

  // Header
  html += `<div class="table-card-header" data-action="toggle-card">`;
  html += `<div class="table-card-header-left">`;
  html += `<svg class="table-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg>`;
  html += `<span class="table-card-name">${escapeHtml(name)}</span>`;
  html += `<span class="table-card-meta">${columns.length} columns${domain ? ' &middot; ' + escapeHtml(domain) : ''}</span>`;
  html += `</div>`;
  html += `<svg class="table-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
  html += `</div>`;

  // Description
  if (desc) {
    html += `<div class="table-card-desc">${escapeHtml(desc)}</div>`;
  }

  // Column table (body)
  if (columns.length > 0) {
    html += `<div class="table-card-body">`;
    html += `<table class="column-table">`;
    html += `<thead><tr><th>Column</th><th>Type</th><th>Description</th><th>Constraints</th></tr></thead>`;
    html += `<tbody>`;
    for (const col of columns) {
      html += buildColumnRow(col);
    }
    html += `</tbody></table></div>`;
  }

  html += `</div>`;
  return html;
}

function buildColumnRow(col) {
  const name = col.name || col.column_name || '';
  const type = col.type || col.data_type || col.dataType || 'string';
  const desc = col.description || '';
  const isPK = col.primary_key || col.pk || col.isPrimaryKey || false;
  const isFK = col.foreign_key || col.fk || col.isForeignKey || false;
  const nullable = col.nullable !== undefined ? col.nullable : true;

  const typeClass = 'dtype-' + type.toLowerCase().replace(/[^a-z]/g, '');

  let badges = '';
  if (isPK) badges += '<span class="key-badge key-pk">PK</span> ';
  if (isFK) badges += '<span class="key-badge key-fk">FK</span> ';
  if (!nullable && !isPK) badges += '<span class="key-badge key-nullable">NOT NULL</span> ';

  return `<tr>
    <td><code style="font-size:var(--text-sm)">${escapeHtml(name)}</code></td>
    <td><span class="dtype-badge ${typeClass}">${escapeHtml(type)}</span></td>
    <td>${escapeHtml(desc)}</td>
    <td>${badges}</td>
  </tr>`;
}

function attachCatalogueEvents(container, portalId, isAdmin = false) {
  // Toggle table cards
  container.querySelectorAll('[data-action="toggle-card"]').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.table-card').classList.toggle('open');
    });
  });

  // Expand all
  container.querySelector('[data-action="expand-all"]')?.addEventListener('click', () => {
    container.querySelectorAll('.table-card').forEach(c => c.classList.add('open'));
  });

  // Collapse all
  container.querySelector('[data-action="collapse-all"]')?.addEventListener('click', () => {
    container.querySelectorAll('.table-card').forEach(c => c.classList.remove('open'));
  });

  // Toggle raw JSON
  container.querySelector('[data-action="toggle-raw"]')?.addEventListener('click', function () {
    const raw = container.querySelector('[data-role="raw-json"]');
    const tables = container.querySelector('[data-role="tables-container"]');
    const isVisible = raw.classList.toggle('visible');
    if (tables) tables.style.display = isVisible ? 'none' : '';
    this.classList.toggle('active', isVisible);
    this.textContent = isVisible ? 'View Structured' : 'View Raw JSON';
  });

  // Search/filter
  container.querySelector('[data-action="search"]')?.addEventListener('input', function () {
    const query = this.value.toLowerCase();
    container.querySelectorAll('.table-card').forEach(card => {
      const name = card.getAttribute('data-table-name') || '';
      const match = !query || name.includes(query);
      card.style.display = match ? '' : 'none';
    });
  });

  // Add table (admin only)
  if (isAdmin) {
    container.querySelector('[data-action="add-table"]')?.addEventListener('click', () => {
      if (window.__app) {
        window.__app.openAddTableDialog(portalId);
      }
    });
  }
}

function buildCatalogueToc(data, tocEl) {
  const tables = data.tables || data.datasets || data.entities || [];
  if (tables.length === 0) return;

  let html = '';
  for (const table of tables) {
    const name = table.name || table.table_name || 'Unnamed';
    html += `<li><a class="toc-link" data-level="2" href="javascript:void(0)" onclick="document.querySelector('.table-card[data-table-name=&quot;${escapeAttr(name.toLowerCase())}&quot;]')?.scrollIntoView({behavior:'smooth'})">${escapeHtml(name)}</a></li>`;
  }
  tocEl.innerHTML = html;
}

function extractLayerName(path) {
  const filename = path.split('/').pop().replace('.json', '');
  return filename.charAt(0).toUpperCase() + filename.slice(1) + ' Layer';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
