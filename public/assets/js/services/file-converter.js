/**
 * File Converter Service
 * Reads dropped files and converts them to markdown or JSON content.
 * Loads vendor libs lazily on first use.
 *
 * @typedef {{ title: string, content: string, type: 'md'|'json', originalName: string }} ConvertedFile
 */

export const ACCEPTED_EXTENSIONS = ['.md', '.txt', '.docx', '.pdf', '.json'];

export function isAcceptedFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

// ─── Lazy Loader Cache ─────────────────────────────────────

let mammothLoaded = false;
let pdfjsModule = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureMammoth() {
  if (mammothLoaded || window.mammoth) { mammothLoaded = true; return; }
  await loadScript('assets/vendor/mammoth.browser.min.js');
  mammothLoaded = true;
}

async function ensurePdfJs() {
  if (pdfjsModule) return;
  pdfjsModule = await import('/assets/vendor/pdfjs/pdf.min.mjs');
  pdfjsModule.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs/pdf.worker.min.mjs';
}

// ─── Public API ────────────────────────────────────────────

/**
 * Convert a File to { title, content, type, originalName }.
 * @param {File} file
 * @returns {Promise<ConvertedFile>}
 */
export async function convertFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const title = humanizeFilename(baseName);

  switch (ext) {
    case 'md':
    case 'txt':
      return { title, content: await readAsText(file), type: 'md', originalName: file.name };

    case 'docx':
      return { title, content: await convertDocx(file), type: 'md', originalName: file.name };

    case 'pdf':
      return { title, content: await convertPdf(file), type: 'md', originalName: file.name };

    case 'json':
      return convertJson(file, title);

    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

/**
 * LLM Librarian hook point (no-op stub).
 * @param {ConvertedFile} converted
 * @returns {Promise<ConvertedFile|null>} null means no modification
 */
export async function llmLibrarianProcess(converted) {
  return null;
}

// ─── File Readers ──────────────────────────────────────────

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsText(file);
  });
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsArrayBuffer(file);
  });
}

// ─── Format Converters ─────────────────────────────────────

async function convertDocx(file) {
  await ensureMammoth();
  const arrayBuffer = await readAsArrayBuffer(file);
  const result = await window.mammoth.convertToHtml({ arrayBuffer });
  return htmlToMarkdown(result.value);
}

async function convertPdf(file) {
  await ensurePdfJs();
  const arrayBuffer = await readAsArrayBuffer(file);
  const pdf = await pdfjsModule.getDocument({ data: arrayBuffer }).promise;
  const maxPages = Math.min(pdf.numPages, 50);
  const pages = [];
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items.map(item => item.str).join(' ');
    if (text.trim()) pages.push(text.trim());
  }
  if (pdf.numPages > 50) {
    pages.push(`\n\n> *Note: Only the first 50 of ${pdf.numPages} pages were extracted.*`);
  }
  return pages.join('\n\n');
}

async function convertJson(file, title) {
  const text = await readAsText(file);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('File is not valid JSON.'); }
  return {
    title: json.layer || json.title || json.name || title,
    content: JSON.stringify(json, null, 2),
    type: 'json',
    originalName: file.name
  };
}

// ─── HTML → Markdown ───────────────────────────────────────

function htmlToMarkdown(html) {
  if (!html || !html.trim()) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return nodeToMd(doc.body).replace(/\n{3,}/g, '\n\n').trim();
}

function nodeToMd(node) {
  let result = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent;
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = child.tagName.toLowerCase();
    const inner = nodeToMd(child);

    switch (tag) {
      case 'h1': result += `\n# ${inner.trim()}\n\n`; break;
      case 'h2': result += `\n## ${inner.trim()}\n\n`; break;
      case 'h3': result += `\n### ${inner.trim()}\n\n`; break;
      case 'h4': result += `\n#### ${inner.trim()}\n\n`; break;
      case 'h5': result += `\n##### ${inner.trim()}\n\n`; break;
      case 'h6': result += `\n###### ${inner.trim()}\n\n`; break;
      case 'p': result += `${inner}\n\n`; break;
      case 'strong': case 'b': result += `**${inner}**`; break;
      case 'em': case 'i': result += `*${inner}*`; break;
      case 'a': {
        const href = child.getAttribute('href') || '';
        result += href ? `[${inner}](${href})` : inner;
        break;
      }
      case 'br': result += '\n'; break;
      case 'code': result += `\`${inner}\``; break;
      case 'pre': result += `\n\`\`\`\n${child.textContent}\n\`\`\`\n\n`; break;
      case 'ul': case 'ol': result += `\n${inner}\n`; break;
      case 'li': {
        const parent = child.parentElement?.tagName.toLowerCase();
        const idx = Array.from(child.parentElement.children).indexOf(child);
        const prefix = parent === 'ol' ? `${idx + 1}. ` : '- ';
        result += `${prefix}${inner.trim()}\n`;
        break;
      }
      case 'img': {
        const src = child.getAttribute('src') || '';
        const alt = child.getAttribute('alt') || '';
        result += `![${alt}](${src})`;
        break;
      }
      case 'table': result += '\n' + convertTable(child) + '\n'; break;
      case 'sup': result += `<sup>${inner}</sup>`; break;
      case 'sub': result += `<sub>${inner}</sub>`; break;
      default: result += inner;
    }
  }
  return result;
}

function convertTable(tableEl) {
  const rows = [];
  for (const tr of tableEl.querySelectorAll('tr')) {
    const cells = [];
    for (const td of tr.querySelectorAll('td, th')) {
      cells.push(nodeToMd(td).trim().replace(/\|/g, '\\|').replace(/\n/g, ' '));
    }
    rows.push(cells);
  }
  if (rows.length === 0) return '';

  const maxCols = Math.max(...rows.map(r => r.length));
  const lines = [];
  rows.forEach((cells, i) => {
    while (cells.length < maxCols) cells.push('');
    lines.push('| ' + cells.join(' | ') + ' |');
    if (i === 0) {
      lines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
    }
  });
  return lines.join('\n');
}

// ─── Helpers ───────────────────────────────────────────────

function humanizeFilename(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
