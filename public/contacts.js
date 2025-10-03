// Contact Manager JavaScript

let contactLists = [];
let currentListId = null;
let csvData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadContactLists();
  setupEventListeners();
  setupCSVUpload();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('createListBtn').addEventListener('click', () => openCreateModal());
  document.getElementById('manualForm').addEventListener('submit', handleManualSubmit);
  document.getElementById('csvForm').addEventListener('submit', handleCSVSubmit);
  document.getElementById('sheetsForm').addEventListener('submit', handleSheetsSubmit);
}

// Setup CSV upload
function setupCSVUpload() {
  const zone = document.getElementById('csvUploadZone');
  const input = document.getElementById('csvFileInput');

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleCSVFile(file);
    } else {
      showNotification('Please upload a CSV file', 'error');
    }
  });

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleCSVFile(file);
  });
}

// Handle CSV file upload
async function handleCSVFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    csvData = e.target.result;
    previewCSV(csvData);
    document.getElementById('csvSubmitBtn').disabled = false;
  };
  reader.readAsText(file);
}

// Preview CSV data
function previewCSV(data) {
  const lines = data.trim().split('\n').slice(0, 6); // First 6 lines (header + 5 rows)
  const preview = document.getElementById('csvPreview');
  const content = document.getElementById('csvPreviewContent');

  const table = `
    <table class="contacts-table">
      ${lines.map((line, index) => {
        const cells = line.split(',').map(c => c.trim());
        const tag = index === 0 ? 'th' : 'td';
        return `<tr>${cells.map(c => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`;
      }).join('')}
    </table>
  `;

  content.innerHTML = table;
  preview.style.display = 'block';
}

// Load all contact lists
async function loadContactLists() {
  try {
    const response = await fetch('/api/contacts/list');
    const result = await response.json();

    if (result.success) {
      contactLists = result.data;
      renderContactLists();
    } else {
      showNotification('Failed to load contact lists', 'error');
    }
  } catch (error) {
    console.error('Error loading contact lists:', error);
    showNotification('Error loading contact lists', 'error');
  }
}

// Render contact lists grid
function renderContactLists() {
  const grid = document.getElementById('contactListsGrid');

  if (contactLists.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <p>No contact lists yet. Create your first list to get started!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = contactLists.map(list => `
    <div class="contact-list-card" onclick="viewContactList('${list.id}')">
      <div class="list-header">
        <div>
          <div class="list-title">${escapeHtml(list.name)}</div>
          <span class="source-badge">${escapeHtml(list.source)}</span>
        </div>
      </div>

      ${list.description ? `
        <div class="list-description">${escapeHtml(list.description)}</div>
      ` : ''}

      <div class="list-stats">
        <div class="stat-item">
          <span class="stat-label">Contacts</span>
          <span class="stat-value">${list.total_count || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Updated</span>
          <span class="stat-value" style="font-size: 0.85rem;">
            ${new Date(list.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      ${list.tags && list.tags.length > 0 ? `
        <div style="margin-top: 1rem;">
          ${list.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Switch tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabName + 'Tab').classList.add('active');
}

// Add contact row
function addContactRow() {
  const container = document.getElementById('contactsContainer');
  const row = document.createElement('div');
  row.className = 'contact-row';
  row.innerHTML = `
    <input type="text" placeholder="Name" class="contact-name">
    <input type="text" placeholder="Phone (65xxxxxxxx)" class="contact-phone" required>
    <input type="email" placeholder="Email (optional)" class="contact-email">
    <button type="button" class="btn btn-danger btn-small" onclick="removeContactRow(this)">×</button>
  `;
  container.appendChild(row);
}

// Remove contact row
function removeContactRow(btn) {
  btn.parentElement.remove();
}

// Open create modal
function openCreateModal() {
  document.getElementById('createModal').classList.add('active');
}

// Close create modal
function closeCreateModal() {
  document.getElementById('createModal').classList.remove('active');
  document.getElementById('manualForm').reset();
  document.getElementById('csvForm').reset();
  document.getElementById('sheetsForm').reset();
  csvData = null;
  document.getElementById('csvPreview').style.display = 'none';
}

// Handle manual form submission
async function handleManualSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('listName').value;
  const description = document.getElementById('listDescription').value;

  // Collect contacts from rows
  const rows = document.querySelectorAll('.contact-row');
  const contacts = [];

  for (const row of rows) {
    const name = row.querySelector('.contact-name').value;
    const phone = row.querySelector('.contact-phone').value;
    const email = row.querySelector('.contact-email').value;

    if (phone) {
      contacts.push({
        name: name || '',
        phone: phone,
        email: email || '',
        custom_fields: {}
      });
    }
  }

  if (contacts.length === 0) {
    showNotification('Please add at least one contact', 'error');
    return;
  }

  try {
    const response = await fetch('/api/contacts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        contacts,
        source: 'manual',
        tags: ['manual']
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Contact list created successfully', 'success');
      closeCreateModal();
      await loadContactLists();
    } else {
      showNotification(result.error || 'Failed to create contact list', 'error');
    }
  } catch (error) {
    console.error('Error creating contact list:', error);
    showNotification('Error creating contact list', 'error');
  }
}

// Handle CSV form submission
async function handleCSVSubmit(e) {
  e.preventDefault();

  if (!csvData) {
    showNotification('Please upload a CSV file', 'error');
    return;
  }

  const listName = document.getElementById('csvListName').value;

  try {
    const response = await fetch('/api/contacts/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csv_data: csvData,
        list_name: listName,
        mapping: {
          name: 'name',
          phone: 'phone',
          email: 'email'
        }
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Successfully imported ${result.data.total_count} contacts`, 'success');
      closeCreateModal();
      await loadContactLists();
    } else {
      showNotification(result.error || 'Failed to import CSV', 'error');
    }
  } catch (error) {
    console.error('Error importing CSV:', error);
    showNotification('Error importing CSV', 'error');
  }
}

// Handle Google Sheets form submission
async function handleSheetsSubmit(e) {
  e.preventDefault();

  const listName = document.getElementById('sheetsListName').value;
  const spreadsheetId = document.getElementById('spreadsheetId').value;
  const sheetName = document.getElementById('sheetName').value || 'Clients';
  const range = document.getElementById('sheetRange').value || 'A2:D1000';

  try {
    const response = await fetch('/api/contacts/sync/google-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        range: range
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Successfully synced ${result.data.total_count} contacts`, 'success');
      closeCreateModal();
      await loadContactLists();
    } else {
      showNotification(result.error || 'Failed to sync from Google Sheets', 'error');
    }
  } catch (error) {
    console.error('Error syncing from Google Sheets:', error);
    showNotification('Error syncing from Google Sheets', 'error');
  }
}

// View contact list details
async function viewContactList(id) {
  try {
    const response = await fetch(`/api/contacts/${id}`);
    const result = await response.json();

    if (result.success) {
      const list = result.data;
      currentListId = id;

      const content = `
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div>
              <h3 style="margin: 0 0 0.5rem 0;">${escapeHtml(list.name)}</h3>
              <span class="source-badge">${escapeHtml(list.source)}</span>
            </div>
          </div>

          ${list.description ? `
            <p style="color: #64748b; margin: 1rem 0;">${escapeHtml(list.description)}</p>
          ` : ''}

          <div style="display: flex; gap: 2rem; margin: 1rem 0; padding: 1rem; background: #f8fafc; border-radius: 8px;">
            <div>
              <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Total Contacts</div>
              <div style="font-size: 1.5rem; font-weight: 600; color: #1e293b; margin-top: 0.25rem;">${list.total_count}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Last Updated</div>
              <div style="font-size: 0.9rem; font-weight: 500; color: #1e293b; margin-top: 0.25rem;">
                ${new Date(list.updated_at).toLocaleString()}
              </div>
            </div>
          </div>

          ${list.tags && list.tags.length > 0 ? `
            <div style="margin: 1rem 0;">
              <strong>Tags:</strong>
              ${list.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}

          <div style="margin-top: 1.5rem;">
            <h4>Contacts</h4>
            <table class="contacts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                ${list.contacts.slice(0, 50).map(contact => `
                  <tr>
                    <td>${escapeHtml(contact.name || '-')}</td>
                    <td>${escapeHtml(contact.phone)}</td>
                    <td>${escapeHtml(contact.email || '-')}</td>
                  </tr>
                `).join('')}
                ${list.contacts.length > 50 ? `
                  <tr>
                    <td colspan="3" style="text-align: center; color: #64748b; font-style: italic;">
                      Showing first 50 of ${list.contacts.length} contacts
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('viewModalContent').innerHTML = content;
      document.getElementById('viewModal').classList.add('active');
    }
  } catch (error) {
    console.error('Error viewing contact list:', error);
    showNotification('Error loading contact list details', 'error');
  }
}

// Close view modal
function closeViewModal() {
  document.getElementById('viewModal').classList.remove('active');
  currentListId = null;
}

// Delete current list
async function deleteCurrentList() {
  if (!currentListId) return;

  if (!confirm('Are you sure you want to delete this contact list? This action cannot be undone.')) return;

  try {
    const response = await fetch(`/api/contacts/${currentListId}/delete`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Contact list deleted successfully', 'success');
      closeViewModal();
      await loadContactLists();
    } else {
      showNotification(result.error || 'Failed to delete contact list', 'error');
    }
  } catch (error) {
    console.error('Error deleting contact list:', error);
    showNotification('Error deleting contact list', 'error');
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

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);
