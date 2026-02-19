/**
 * Upload Dialog Component
 * Shows after drag-and-drop: lets admin pick portal, section, title, and preview content.
 * Processes multiple files sequentially with progress indicator.
 * Supports creating new portals and sections inline.
 */
import { convertFile, isAcceptedFile, llmLibrarianProcess } from '../services/file-converter.js';

/**
 * Open the upload dialog for a set of dropped files.
 * @param {Object} opts
 * @param {FileList|File[]} opts.files
 * @param {Array} opts.portals
 * @param {Map} opts.contentIndices - Map<portalId, sections[]>
 * @param {string|null} opts.currentPortalId
 * @param {Function} opts.onComplete
 */
export async function openUploadDialog({ files, portals, contentIndices, currentPortalId, onComplete }) {
  const validFiles = Array.from(files).filter(isAcceptedFile);
  if (validFiles.length === 0) {
    showToast('No supported files found. Accepted: .md, .txt, .docx, .pdf, .json');
    return;
  }

  let uploaded = 0;
  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    const progress = validFiles.length > 1 ? `File ${i + 1} of ${validFiles.length}` : null;

    try {
      const converted = await convertFile(file);
      const enhanced = await llmLibrarianProcess(converted);
      const finalContent = enhanced || converted;

      const result = await showPlacementDialog({
        converted: finalContent,
        portals,
        contentIndices,
        currentPortalId,
        progress
      });

      if (result === 'cancel') break;
      if (result === 'skip') continue;

      // Create new portal if needed
      if (result.newPortal) {
        await createPortal(result.newPortal);
        // Add to local portals list so next file in batch can use it
        portals.push({ id: result.portalId, title: result.newPortal.title });
        contentIndices.set(result.portalId, []);
      }

      await uploadContent(result);
      uploaded++;
    } catch (err) {
      const action = await showErrorDialog(file.name, err.message, progress);
      if (action === 'cancel') break;
    }
  }

  if (uploaded > 0) onComplete();
}

// ─── Placement Dialog ──────────────────────────────────────

const NEW_PORTAL_VALUE = '__new_portal__';
const NEW_SECTION_VALUE = '__new_section__';

function showPlacementDialog({ converted, portals, contentIndices, currentPortalId, progress }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'admin-overlay';

    const portalOpts = portals.map(p =>
      `<option value="${esc(p.id)}"${p.id === currentPortalId ? ' selected' : ''}>${esc(p.title)}</option>`
    ).join('');

    overlay.innerHTML = `
      <div class="admin-modal upload-dialog" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h2 class="admin-modal-title">
            Upload File${progress ? ` <span class="upload-progress">${esc(progress)}</span>` : ''}
          </h2>
          <button class="admin-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="admin-modal-body">
          <form class="admin-form" autocomplete="off">
            <div class="admin-field">
              <label class="admin-label">Portal <span class="admin-field-req">*</span></label>
              <select name="portal" class="admin-input admin-select">
                ${portalOpts}
                <option value="${NEW_PORTAL_VALUE}">+ New Portal...</option>
              </select>
              <input type="text" name="newPortalName" class="admin-input upload-inline-input"
                     placeholder="New portal name" style="display:none">
            </div>
            <div class="admin-field">
              <label class="admin-label">Section <span class="admin-field-req">*</span></label>
              <select name="section" class="admin-input admin-select"></select>
              <input type="text" name="newSectionName" class="admin-input upload-inline-input"
                     placeholder="New section name" style="display:none">
            </div>
            <div class="admin-field">
              <label class="admin-label">Title <span class="admin-field-req">*</span></label>
              <input type="text" name="title" class="admin-input" value="${esc(converted.title)}" required>
            </div>
            <div class="admin-field">
              <label class="admin-label">Preview <span class="upload-preview-type">${esc(converted.type)}</span></label>
              <div class="upload-preview">${escHtml(previewContent(converted))}</div>
            </div>
            <div class="admin-form-error" hidden></div>
            <div class="admin-form-actions">
              ${progress ? '<button type="button" class="admin-btn admin-btn--secondary" data-action="skip">Skip</button>' : ''}
              <button type="button" class="admin-btn admin-btn--secondary" data-action="cancel">Cancel</button>
              <button type="submit" class="admin-btn admin-btn--primary">Upload</button>
            </div>
          </form>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('admin-overlay--visible'));
    });

    const form = overlay.querySelector('form');
    const portalSelect = overlay.querySelector('[name="portal"]');
    const newPortalInput = overlay.querySelector('[name="newPortalName"]');
    const sectionSelect = overlay.querySelector('[name="section"]');
    const newSectionInput = overlay.querySelector('[name="newSectionName"]');
    const closeBtn = overlay.querySelector('.admin-modal-close');
    const errorEl = overlay.querySelector('.admin-form-error');

    // Populate section dropdown based on selected portal
    function populateSections() {
      const pid = portalSelect.value;
      const isNewPortal = pid === NEW_PORTAL_VALUE;

      // Toggle new portal input
      newPortalInput.style.display = isNewPortal ? '' : 'none';
      if (isNewPortal) newPortalInput.focus();

      // For new portals, only show "+ New Section..."
      if (isNewPortal) {
        sectionSelect.innerHTML = `<option value="${NEW_SECTION_VALUE}">+ New Section...</option>`;
        newSectionInput.style.display = '';
        newSectionInput.focus();
        return;
      }

      const sections = contentIndices.get(pid) || [];
      const opts = sections
        .filter(s => s.children) // only folders/sections
        .map(s => `<option value="${esc(s.path)}">${esc(s.title)}</option>`)
        .join('');
      sectionSelect.innerHTML = opts + `<option value="${NEW_SECTION_VALUE}">+ New Section...</option>`;
      newSectionInput.style.display = 'none';
    }
    populateSections();
    portalSelect.addEventListener('change', populateSections);

    // Toggle new section input when selection changes
    sectionSelect.addEventListener('change', () => {
      const isNew = sectionSelect.value === NEW_SECTION_VALUE;
      newSectionInput.style.display = isNew ? '' : 'none';
      if (isNew) newSectionInput.focus();
    });

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }

    closeBtn.addEventListener('click', () => cleanup('cancel'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup('cancel');
    });

    overlay.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => cleanup(btn.dataset.action));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      errorEl.hidden = true;

      const titleInput = overlay.querySelector('input[name="title"]');
      const title = titleInput.value.trim();
      if (!title) {
        errorEl.textContent = 'Title is required';
        errorEl.hidden = false;
        return;
      }

      // Resolve portal
      const isNewPortal = portalSelect.value === NEW_PORTAL_VALUE;
      let portalId, newPortal = null;
      if (isNewPortal) {
        const portalName = newPortalInput.value.trim();
        if (!portalName) {
          errorEl.textContent = 'Portal name is required';
          errorEl.hidden = false;
          newPortalInput.focus();
          return;
        }
        portalId = slugify(portalName);
        if (!portalId) {
          errorEl.textContent = 'Portal name must contain at least one letter or number';
          errorEl.hidden = false;
          newPortalInput.focus();
          return;
        }
        newPortal = { id: portalId, title: portalName };
      } else {
        portalId = portalSelect.value;
      }

      // Resolve section
      const isNewSection = sectionSelect.value === NEW_SECTION_VALUE;
      let sectionPath;
      if (isNewSection) {
        const sectionName = newSectionInput.value.trim();
        if (!sectionName) {
          errorEl.textContent = 'Section name is required';
          errorEl.hidden = false;
          newSectionInput.focus();
          return;
        }
        sectionPath = slugify(sectionName);
        if (!sectionPath) {
          errorEl.textContent = 'Section name must contain at least one letter or number';
          errorEl.hidden = false;
          newSectionInput.focus();
          return;
        }
      } else {
        sectionPath = sectionSelect.value;
      }

      cleanup({
        portalId,
        sectionPath,
        title,
        content: converted.content,
        type: converted.type,
        newPortal
      });
    });

    // Focus title input
    setTimeout(() => overlay.querySelector('[name="title"]')?.focus(), 50);
  });
}

// ─── Error Dialog ──────────────────────────────────────────

function showErrorDialog(fileName, errorMessage, progress) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'admin-overlay';
    overlay.innerHTML = `
      <div class="admin-modal upload-dialog" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h2 class="admin-modal-title">
            Upload Error${progress ? ` <span class="upload-progress">${esc(progress)}</span>` : ''}
          </h2>
          <button class="admin-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="admin-modal-body">
          <p style="margin:0 0 8px"><strong>${escHtml(fileName)}</strong></p>
          <p class="admin-form-error" style="display:block">${escHtml(errorMessage)}</p>
          <div class="admin-form-actions" style="margin-top:16px">
            ${progress ? '<button type="button" class="admin-btn admin-btn--secondary" data-action="skip">Skip</button>' : ''}
            <button type="button" class="admin-btn admin-btn--secondary" data-action="cancel">Cancel All</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('admin-overlay--visible'));
    });

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector('.admin-modal-close').addEventListener('click', () => cleanup('skip'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup('skip'); });
    overlay.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => cleanup(btn.dataset.action));
    });
  });
}

// ─── API Calls ─────────────────────────────────────────────

async function createPortal({ id, title }) {
  const resp = await fetch('/api/portals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, title, subtitle: '', icon: 'book', sections: '' })
  });
  if (!resp.ok) {
    let msg = 'Failed to create portal';
    try { const err = await resp.json(); msg = err.error || msg; } catch {}
    throw new Error(msg);
  }
}

async function uploadContent({ portalId, sectionPath, title, content, type }) {
  const slug = slugify(title);
  const ext = type === 'json' ? '.json' : '.md';
  const filePath = `${sectionPath}/${slug}${ext}`;
  const contentType = type === 'json' ? 'application/json' : 'text/plain';

  let body = content;
  if (type === 'md' && !content.trimStart().startsWith('#')) {
    body = `# ${title}\n\n${content}`;
  }

  const resp = await fetch(
    `/api/portals/${encodeURIComponent(portalId)}/content/${filePath}`,
    { method: 'POST', headers: { 'Content-Type': contentType }, body }
  );

  if (!resp.ok) {
    let msg = 'Upload failed';
    try { const err = await resp.json(); msg = err.error || msg; } catch {}
    throw new Error(msg);
  }
}

// ─── Helpers ───────────────────────────────────────────────

function previewContent(converted) {
  const text = converted.content || '';
  const maxLen = 800;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n... (truncated)';
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function showToast(message) {
  const el = document.createElement('div');
  el.className = 'upload-toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('upload-toast--fade'); }, 2500);
  setTimeout(() => el.remove(), 3000);
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
