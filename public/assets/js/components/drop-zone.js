/**
 * Drop Zone Component
 * Attaches drag-and-drop listeners to the main content area.
 * Only active when admin is logged in.
 */
import { openUploadDialog } from './upload-dialog.js';
import { ACCEPTED_EXTENSIONS } from '../services/file-converter.js';

let dropZoneOverlay = null;
let dragCounter = 0;

/**
 * Initialize the drop zone on the main content area.
 * @param {Object} opts
 * @param {HTMLElement} opts.targetEl - The #main-content element
 * @param {Function} opts.getContext - Returns { isAdmin, portals, contentIndices, currentPortalId }
 * @param {Function} opts.onComplete - Called after uploads finish (to refresh nav)
 */
export function initDropZone({ targetEl, getContext, onComplete }) {
  // Prevent the browser from opening dropped files anywhere on the page
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  targetEl.addEventListener('dragenter', (e) => {
    if (!getContext().isAdmin) return;
    if (!hasDragFiles(e)) return;
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) showOverlay(targetEl);
  });

  targetEl.addEventListener('dragover', (e) => {
    if (!getContext().isAdmin) return;
    if (!hasDragFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  targetEl.addEventListener('dragleave', (e) => {
    if (!getContext().isAdmin) return;
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      hideOverlay();
    }
  });

  targetEl.addEventListener('drop', (e) => {
    const ctx = getContext();
    dragCounter = 0;
    hideOverlay();
    if (!ctx.isAdmin) return;
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    openUploadDialog({
      files,
      portals: ctx.portals,
      contentIndices: ctx.contentIndices,
      currentPortalId: ctx.currentPortalId,
      onComplete
    }).catch(err => {
      console.error('[drop-zone] Upload dialog error:', err);
    });
  });
}

function hasDragFiles(e) {
  if (e.dataTransfer.types) {
    return e.dataTransfer.types.indexOf('Files') !== -1;
  }
  return false;
}

function showOverlay(targetEl) {
  if (dropZoneOverlay) return;
  dropZoneOverlay = document.createElement('div');
  dropZoneOverlay.className = 'drop-zone-overlay';
  dropZoneOverlay.innerHTML = `
    <div class="drop-zone-content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
           width="48" height="48">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <div class="drop-zone-text">Drop files to upload</div>
      <div class="drop-zone-hint">${ACCEPTED_EXTENSIONS.join(', ')}</div>
    </div>`;

  // Ensure the target is a positioning context
  const pos = getComputedStyle(targetEl).position;
  if (pos === 'static') targetEl.style.position = 'relative';

  targetEl.appendChild(dropZoneOverlay);
}

function hideOverlay() {
  if (dropZoneOverlay) {
    dropZoneOverlay.remove();
    dropZoneOverlay = null;
  }
}
