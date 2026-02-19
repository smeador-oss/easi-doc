/**
 * Page Editor Component
 * Split-pane markdown editor: CodeMirror 5 on the left, live preview on the right.
 * Uses 300ms debounce for preview updates.
 */

let editorInstance = null;
let debounceTimer = null;

/**
 * Open the split-pane editor for a markdown page.
 * @param {Object} opts
 * @param {string} opts.portalId - Portal ID
 * @param {string} opts.contentPath - Path to the file (e.g. "guides/overview.md")
 * @param {string} opts.title - Page title for the header
 * @param {string} opts.content - Current file content
 * @param {HTMLElement} opts.containerEl - Element to render into
 * @param {Function} opts.onSave - async (newContent) => void
 * @param {Function} opts.onCancel - () => void
 */
export function openPageEditor({ portalId, contentPath, title, content, containerEl, onSave, onCancel }) {
  // Clean up any existing editor
  closePageEditor();

  containerEl.innerHTML = '';
  containerEl.classList.add('page-editor-active');

  // Build editor UI
  const wrapper = document.createElement('div');
  wrapper.className = 'page-editor';
  wrapper.innerHTML = `
    <div class="page-editor-toolbar">
      <div class="page-editor-title">${escapeHtml(title)}</div>
      <div class="page-editor-path">${escapeHtml(contentPath)}</div>
      <div class="page-editor-actions">
        <button class="admin-btn admin-btn--secondary" data-action="cancel">Cancel</button>
        <button class="admin-btn admin-btn--primary" data-action="save">Save</button>
      </div>
    </div>
    <div class="page-editor-split">
      <div class="page-editor-left">
        <textarea class="page-editor-textarea"></textarea>
      </div>
      <div class="page-editor-right">
        <article class="md-content page-editor-preview"></article>
      </div>
    </div>
  `;

  containerEl.appendChild(wrapper);

  // Initialize CodeMirror
  const textarea = wrapper.querySelector('.page-editor-textarea');
  const previewEl = wrapper.querySelector('.page-editor-preview');

  if (typeof CodeMirror !== 'undefined') {
    editorInstance = CodeMirror.fromTextArea(textarea, {
      mode: 'markdown',
      lineNumbers: true,
      lineWrapping: true,
      theme: 'default',
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      viewportMargin: Infinity
    });
    editorInstance.setValue(content || '');
    editorInstance.on('change', () => updatePreview(editorInstance.getValue(), previewEl));
    // Initial render
    updatePreview(content || '', previewEl);
    setTimeout(() => editorInstance.refresh(), 50);
  } else {
    // Fallback: plain textarea
    textarea.value = content || '';
    textarea.style.display = 'block';
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.fontFamily = 'var(--font-mono)';
    textarea.addEventListener('input', () => updatePreview(textarea.value, previewEl));
    updatePreview(content || '', previewEl);
  }

  // Button handlers
  wrapper.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    closePageEditor();
    containerEl.classList.remove('page-editor-active');
    if (onCancel) onCancel();
  });

  wrapper.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const saveBtn = wrapper.querySelector('[data-action="save"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const newContent = editorInstance ? editorInstance.getValue() : textarea.value;
      await onSave(newContent);
      closePageEditor();
      containerEl.classList.remove('page-editor-active');
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      alert('Save failed: ' + (err.message || 'Unknown error'));
    }
  });
}

/**
 * Open a JSON editor with raw JSON mode.
 * @param {Object} opts - Same as openPageEditor but content is JSON string
 */
export function openJsonEditor({ portalId, contentPath, title, content, containerEl, onSave, onCancel }) {
  closePageEditor();

  containerEl.innerHTML = '';
  containerEl.classList.add('page-editor-active');

  const wrapper = document.createElement('div');
  wrapper.className = 'page-editor page-editor--json';
  wrapper.innerHTML = `
    <div class="page-editor-toolbar">
      <div class="page-editor-title">${escapeHtml(title)}</div>
      <div class="page-editor-path">${escapeHtml(contentPath)}</div>
      <div class="page-editor-actions">
        <button class="admin-btn admin-btn--secondary" data-action="cancel">Cancel</button>
        <button class="admin-btn admin-btn--primary" data-action="save">Save</button>
      </div>
    </div>
    <div class="page-editor-full">
      <textarea class="page-editor-textarea"></textarea>
    </div>
    <div class="page-editor-error" hidden></div>
  `;

  containerEl.appendChild(wrapper);

  const textarea = wrapper.querySelector('.page-editor-textarea');
  const errorEl = wrapper.querySelector('.page-editor-error');

  if (typeof CodeMirror !== 'undefined') {
    editorInstance = CodeMirror.fromTextArea(textarea, {
      mode: { name: 'javascript', json: true },
      lineNumbers: true,
      lineWrapping: true,
      theme: 'default',
      indentUnit: 2,
      tabSize: 2,
      matchBrackets: true,
      viewportMargin: Infinity
    });
    editorInstance.setValue(content || '{}');
    setTimeout(() => editorInstance.refresh(), 50);
  } else {
    textarea.value = content || '{}';
    textarea.style.display = 'block';
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.fontFamily = 'var(--font-mono)';
  }

  wrapper.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    closePageEditor();
    containerEl.classList.remove('page-editor-active');
    if (onCancel) onCancel();
  });

  wrapper.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const saveBtn = wrapper.querySelector('[data-action="save"]');
    const raw = editorInstance ? editorInstance.getValue() : textarea.value;

    // Validate JSON
    try {
      JSON.parse(raw);
    } catch (e) {
      errorEl.textContent = 'Invalid JSON: ' + e.message;
      errorEl.hidden = false;
      return;
    }

    errorEl.hidden = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await onSave(raw);
      closePageEditor();
      containerEl.classList.remove('page-editor-active');
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      errorEl.textContent = 'Save failed: ' + (err.message || 'Unknown error');
      errorEl.hidden = false;
    }
  });
}

export function closePageEditor() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (editorInstance) {
    editorInstance.toTextArea();
    editorInstance = null;
  }
}

function updatePreview(content, previewEl) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (typeof marked !== 'undefined') {
      previewEl.innerHTML = marked.parse(content || '');
      // Highlight code blocks in preview
      if (typeof hljs !== 'undefined') {
        previewEl.querySelectorAll('pre code').forEach(block => {
          hljs.highlightElement(block);
        });
      }
    } else {
      previewEl.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
    }
  }, 300);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
