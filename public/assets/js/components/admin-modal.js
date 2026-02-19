/**
 * Admin Modal Component
 * Reusable form modal for admin actions (create portal, add page, add table, manage admins).
 * Follows the same DOM-creation + overlay pattern as about-modal.js.
 */

let modalEl = null;

/**
 * Open an admin modal with a dynamic form.
 * @param {Object} config
 * @param {string} config.title - Modal title
 * @param {Array}  config.fields - Field definitions: { name, label, type, required, placeholder, accept, options, rows }
 *   type: 'text' | 'password' | 'textarea' | 'select' | 'file' | 'hint'
 *   options: [{ value, label }] for select type
 * @param {string} [config.submitLabel='Submit'] - Submit button text
 * @param {boolean} [config.allowClose=true] - Whether the user can close the modal
 * @param {Function} config.onSubmit - async (formData) => void. Throw to show error.
 */
export function openAdminModal(config) {
  if (modalEl) return;

  const { title, fields, submitLabel = 'Submit', allowClose = true, onSubmit } = config;

  modalEl = document.createElement('div');
  modalEl.className = 'admin-overlay';
  modalEl.innerHTML = `
    <div class="admin-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="admin-modal-header">
        <h2 class="admin-modal-title">${esc(title)}</h2>
        <button class="admin-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="admin-modal-body">
        <form class="admin-form" autocomplete="off">
          ${fields.map(f => renderField(f)).join('')}
          <div class="admin-form-error" hidden></div>
          <div class="admin-form-actions">
            <button type="button" class="admin-btn admin-btn--secondary" data-action="cancel">Cancel</button>
            <button type="submit" class="admin-btn admin-btn--primary">${esc(submitLabel)}</button>
          </div>
        </form>
      </div>
    </div>`;

  document.body.appendChild(modalEl);

  // Close handlers
  if (allowClose) {
    modalEl.querySelector('.admin-modal-close').addEventListener('click', closeAdminModal);
    modalEl.querySelector('[data-action="cancel"]').addEventListener('click', closeAdminModal);
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeAdminModal();
    });
    document.addEventListener('keydown', onEscapeKey);
  } else {
    // Hide close/cancel buttons when modal cannot be dismissed
    modalEl.querySelector('.admin-modal-close').style.display = 'none';
    const cancelBtn = modalEl.querySelector('[data-action="cancel"]');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modalEl.classList.add('admin-overlay--visible');
    });
  });

  // Focus first input
  const firstInput = modalEl.querySelector('input, textarea, select');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);

  // Submit handler
  const form = modalEl.querySelector('.admin-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorEl = form.querySelector('.admin-form-error');
    errorEl.hidden = true;

    // Gather form data
    const formData = {};
    for (const field of fields) {
      if (field.type === 'hint') continue;
      if (field.type === 'file') {
        const input = form.querySelector(`[name="${field.name}"]`);
        formData[field.name] = input?.files?.[0] || null;
      } else if (field.type === 'password') {
        // Don't trim passwords — spaces may be intentional
        formData[field.name] = form.querySelector(`[name="${field.name}"]`)?.value || '';
      } else {
        formData[field.name] = form.querySelector(`[name="${field.name}"]`)?.value?.trim() || '';
      }
    }

    // Required validation
    for (const field of fields) {
      if (field.type === 'hint') continue;
      if (field.required && !formData[field.name]) {
        errorEl.textContent = `${field.label} is required.`;
        errorEl.hidden = false;
        return;
      }
    }

    // Disable form
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      await onSubmit(formData);
      closeAdminModal();
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  });
}

export function closeAdminModal() {
  if (!modalEl) return;
  document.removeEventListener('keydown', onEscapeKey);

  modalEl.classList.remove('admin-overlay--visible');
  modalEl.addEventListener('transitionend', () => {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }, { once: true });

  setTimeout(() => {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }, 400);
}

function onEscapeKey(e) {
  if (e.key === 'Escape') closeAdminModal();
}

function renderField(f) {
  // Hint-only field (no input, just informational text)
  if (f.type === 'hint') {
    return `<div class="admin-field">
      <div class="admin-hint">${esc(f.hint)}</div>
    </div>`;
  }

  const req = f.required ? ' <span class="admin-field-req">*</span>' : '';
  let input = '';

  switch (f.type) {
    case 'textarea':
      input = `<textarea name="${esc(f.name)}" class="admin-input admin-textarea" placeholder="${esc(f.placeholder || '')}" rows="${f.rows || 8}">${esc(f.value || '')}</textarea>`;
      break;
    case 'select':
      input = `<select name="${esc(f.name)}" class="admin-input admin-select">
        ${(f.options || []).map(o => `<option value="${esc(o.value)}"${o.value === f.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>`;
      break;
    case 'file':
      input = `<input type="file" name="${esc(f.name)}" class="admin-input admin-file" accept="${esc(f.accept || '')}">`;
      break;
    case 'password':
      input = `<input type="password" name="${esc(f.name)}" class="admin-input" placeholder="${esc(f.placeholder || '')}" autocomplete="new-password">`;
      break;
    default: // text
      input = `<input type="text" name="${esc(f.name)}" class="admin-input" placeholder="${esc(f.placeholder || '')}" value="${esc(f.value || '')}">`;
  }

  return `<div class="admin-field">
    <label class="admin-label">${esc(f.label)}${req}</label>
    ${f.hint ? `<div class="admin-hint">${esc(f.hint)}</div>` : ''}
    ${input}
  </div>`;
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
