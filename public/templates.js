// Template Manager JavaScript

let templates = [];
let categories = [];
let currentTemplateId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  await loadCategories();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('createTemplateBtn').addEventListener('click', () => openTemplateModal());
  document.getElementById('templateForm').addEventListener('submit', handleTemplateSubmit);
  document.getElementById('searchInput').addEventListener('input', filterTemplates);
  document.getElementById('categoryFilter').addEventListener('change', filterTemplates);
  document.getElementById('templateContent').addEventListener('input', updatePreview);
}

// Load all templates
async function loadTemplates(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.search) queryParams.append('search', filters.search);

    const response = await fetch(`/api/templates/list?${queryParams}`);
    const result = await response.json();

    if (result.success) {
      templates = result.data;
      renderTemplates();
    } else {
      showNotification('Failed to load templates', 'error');
    }
  } catch (error) {
    console.error('Error loading templates:', error);
    showNotification('Error loading templates', 'error');
  }
}

// Load categories
async function loadCategories() {
  try {
    const response = await fetch('/api/templates/categories');
    const result = await response.json();

    if (result.success) {
      categories = result.data;
      populateCategoryFilter();
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// Populate category filter dropdown
function populateCategoryFilter() {
  const filter = document.getElementById('categoryFilter');
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
    filter.appendChild(option);
  });
}

// Render templates grid
function renderTemplates() {
  const grid = document.getElementById('templatesGrid');

  if (templates.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <p>No templates found. Create your first template to get started!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = templates.map(template => `
    <div class="template-card" onclick="viewTemplate('${template.id}')">
      <div class="template-header">
        <div>
          <div class="template-title">${escapeHtml(template.name)}</div>
          <span class="template-category">${escapeHtml(template.category)}</span>
        </div>
      </div>

      <div class="template-content">
        ${escapeHtml(template.content.substring(0, 150))}${template.content.length > 150 ? '...' : ''}
      </div>

      ${template.variables && template.variables.length > 0 ? `
        <div class="template-variables">
          ${template.variables.map(v => `<span class="variable-tag">{{${escapeHtml(v)}}}</span>`).join('')}
        </div>
      ` : ''}

      <div class="template-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="editTemplate('${template.id}')" title="Edit">✏️</button>
        <button class="btn-icon" onclick="duplicateTemplate('${template.id}')" title="Duplicate">📋</button>
        <button class="btn-icon" onclick="deleteTemplate('${template.id}')" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

// Filter templates
function filterTemplates() {
  const search = document.getElementById('searchInput').value;
  const category = document.getElementById('categoryFilter').value;

  const filters = {};
  if (search) filters.search = search;
  if (category) filters.category = category;

  loadTemplates(filters);
}

// Open template modal (create or edit)
function openTemplateModal(template = null) {
  const modal = document.getElementById('templateModal');
  const form = document.getElementById('templateForm');
  const title = document.getElementById('modalTitle');

  form.reset();

  if (template) {
    title.textContent = 'Edit Template';
    document.getElementById('templateId').value = template.id;
    document.getElementById('templateName').value = template.name;
    document.getElementById('templateCategory').value = template.category;
    document.getElementById('templateContent').value = template.content;
    document.getElementById('imageUrl').value = template.image_url || '';
    currentTemplateId = template.id;
  } else {
    title.textContent = 'Create Template';
    document.getElementById('templateId').value = '';
    currentTemplateId = null;
  }

  updatePreview();
  modal.classList.add('active');
}

// Close template modal
function closeTemplateModal() {
  document.getElementById('templateModal').classList.remove('active');
  currentTemplateId = null;
}

// Update preview
function updatePreview() {
  const content = document.getElementById('templateContent').value;
  const preview = document.getElementById('templatePreview');

  // Replace variables with placeholder values
  let previewText = content;
  const variables = content.match(/{{([^}]+)}}/g);

  if (variables) {
    variables.forEach(v => {
      const varName = v.replace(/[{}]/g, '').trim();
      previewText = previewText.replace(v, `[${varName}]`);
    });
  }

  preview.textContent = previewText || 'Preview will appear here...';
}

// Handle template form submission
async function handleTemplateSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('templateId').value;
  const templateData = {
    name: document.getElementById('templateName').value,
    category: document.getElementById('templateCategory').value,
    content: document.getElementById('templateContent').value,
    image_url: document.getElementById('imageUrl').value || null
  };

  try {
    const url = id ? `/api/templates/${id}/update` : '/api/templates/create';
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    });

    const result = await response.json();

    if (result.success) {
      showNotification(id ? 'Template updated successfully' : 'Template created successfully', 'success');
      closeTemplateModal();
      await loadTemplates();
    } else {
      showNotification(result.error || 'Failed to save template', 'error');
    }
  } catch (error) {
    console.error('Error saving template:', error);
    showNotification('Error saving template', 'error');
  }
}

// View template details
async function viewTemplate(id) {
  try {
    const response = await fetch(`/api/templates/${id}`);
    const result = await response.json();

    if (result.success) {
      const template = result.data;
      currentTemplateId = id;

      const content = `
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div>
              <h3 style="margin: 0 0 0.5rem 0;">${escapeHtml(template.name)}</h3>
              <span class="template-category">${escapeHtml(template.category)}</span>
            </div>
          </div>

          ${template.variables && template.variables.length > 0 ? `
            <div style="margin: 1rem 0;">
              <strong>Variables:</strong>
              <div class="template-variables" style="margin-top: 0.5rem;">
                ${template.variables.map(v => `<span class="variable-tag">{{${escapeHtml(v)}}}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div style="margin: 1rem 0;">
            <strong>Content:</strong>
            <div class="preview-box" style="margin-top: 0.5rem;">
              ${escapeHtml(template.content)}
            </div>
          </div>

          ${template.image_url ? `
            <div style="margin: 1rem 0;">
              <strong>Image:</strong>
              <div style="margin-top: 0.5rem;">
                <a href="${escapeHtml(template.image_url)}" target="_blank" style="color: #3b82f6;">
                  ${escapeHtml(template.image_url)}
                </a>
              </div>
            </div>
          ` : ''}

          <div style="margin: 1rem 0; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.85rem; color: #64748b;">
            <div>Created: ${new Date(template.created_at).toLocaleString()}</div>
            ${template.updated_at !== template.created_at ? `
              <div>Updated: ${new Date(template.updated_at).toLocaleString()}</div>
            ` : ''}
          </div>
        </div>
      `;

      document.getElementById('viewModalContent').innerHTML = content;
      document.getElementById('viewModal').classList.add('active');
    }
  } catch (error) {
    console.error('Error viewing template:', error);
    showNotification('Error loading template details', 'error');
  }
}

// Close view modal
function closeViewModal() {
  document.getElementById('viewModal').classList.remove('active');
}

// Edit from view modal
async function editFromView() {
  if (!currentTemplateId) return;

  try {
    const response = await fetch(`/api/templates/${currentTemplateId}`);
    const result = await response.json();

    if (result.success) {
      closeViewModal();
      openTemplateModal(result.data);
    }
  } catch (error) {
    console.error('Error loading template for edit:', error);
  }
}

// Edit template
async function editTemplate(id) {
  try {
    const response = await fetch(`/api/templates/${id}`);
    const result = await response.json();

    if (result.success) {
      openTemplateModal(result.data);
    }
  } catch (error) {
    console.error('Error loading template:', error);
    showNotification('Error loading template', 'error');
  }
}

// Duplicate template
async function duplicateTemplate(id) {
  if (!confirm('Create a copy of this template?')) return;

  try {
    const response = await fetch(`/api/templates/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Template duplicated successfully', 'success');
      await loadTemplates();
    } else {
      showNotification(result.error || 'Failed to duplicate template', 'error');
    }
  } catch (error) {
    console.error('Error duplicating template:', error);
    showNotification('Error duplicating template', 'error');
  }
}

// Delete template
async function deleteTemplate(id) {
  if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) return;

  try {
    const response = await fetch(`/api/templates/${id}/delete`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Template deleted successfully', 'success');
      await loadTemplates();
    } else {
      showNotification(result.error || 'Failed to delete template', 'error');
    }
  } catch (error) {
    console.error('Error deleting template:', error);
    showNotification('Error deleting template', 'error');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
