// Enhanced Contact Manager JavaScript

let allContacts = [];
let filteredContacts = [];
let selectedContacts = new Set();
let currentPage = 1;
const contactsPerPage = 50;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllContacts();
  setupEventListeners();
  setupCSVUpload();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('createListBtn').addEventListener('click', () => openCreateModal());
  document.getElementById('downloadTemplateBtn').addEventListener('click', () => downloadCSVTemplate());
  document.getElementById('manualForm').addEventListener('submit', handleManualSubmit);
  document.getElementById('csvForm').addEventListener('submit', handleCSVSubmit);
  document.getElementById('sheetsForm').addEventListener('submit', handleSheetsSubmit);
  document.getElementById('editForm').addEventListener('submit', handleEditSubmit);
  document.getElementById('broadcastForm').addEventListener('submit', handleBroadcastSubmit);

  // Search functionality
  document.getElementById('searchInput').addEventListener('input', handleSearch);

  // Tier filter
  document.getElementById('tierFilter').addEventListener('change', handleTierFilter);

  // Select all checkbox
  document.getElementById('selectAll').addEventListener('change', handleSelectAll);

  // Bulk action buttons
  document.getElementById('broadcastBtn').addEventListener('click', openBroadcastModal);
  document.getElementById('deleteSelectedBtn').addEventListener('click', handleDeleteSelected);

  // Pagination
  document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
  document.getElementById('nextPage').addEventListener('click', () => changePage(1));
}

// Load all contacts from database
async function loadAllContacts() {
  try {
    const response = await fetch('/api/broadcast-contacts');
    const result = await response.json();

    if (result.success) {
      allContacts = result.data || [];
      filteredContacts = [...allContacts];
      renderContacts();
    } else {
      showNotification('Failed to load contacts', 'error');
    }
  } catch (error) {
    console.error('Error loading contacts:', error);
    showNotification('Error loading contacts', 'error');
  }
}

// Render contacts table
function renderContacts() {
  const tbody = document.getElementById('contactsTableBody');
  const pagination = document.getElementById('pagination');

  if (filteredContacts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>No contacts found. Try adjusting your filters or create a new contact list.</p>
        </td>
      </tr>
    `;
    pagination.style.display = 'none';
    return;
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredContacts.length / contactsPerPage);
  const startIndex = (currentPage - 1) * contactsPerPage;
  const endIndex = startIndex + contactsPerPage;
  const pageContacts = filteredContacts.slice(startIndex, endIndex);

  // Render table rows
  tbody.innerHTML = pageContacts.map(contact => `
    <tr data-contact-id="${contact.id}">
      <td class="checkbox-cell">
        <input type="checkbox"
               class="contact-checkbox row-checkbox"
               data-contact-id="${contact.id}"
               ${selectedContacts.has(contact.id) ? 'checked' : ''}
               onchange="handleRowCheckboxChange(this)">
      </td>
      <td>
        <div class="contact-name">${escapeHtml(contact.name || '-')}</div>
      </td>
      <td>
        <div class="contact-phone">${escapeHtml(contact.phone)}</div>
      </td>
      <td>
        <div class="contact-email">${escapeHtml(contact.email || '-')}</div>
      </td>
      <td>
        <span class="tier-badge tier-${(contact.tier || 'standard').toLowerCase()}">
          ${escapeHtml(contact.tier || 'Standard')}
        </span>
      </td>
      <td>
        <small style="color: #64748b;">${escapeHtml(contact.list_name || '-')}</small>
      </td>
      <td>
        <div class="action-buttons">
          <button class="icon-btn edit" onclick="openEditModal('${contact.id}')" title="Edit contact">
            ✏️
          </button>
          <button class="icon-btn delete" onclick="handleDeleteContact('${contact.id}')" title="Delete contact">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Update pagination
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
  } else {
    pagination.style.display = 'none';
  }

  updateBulkActionsUI();
}

// Handle row checkbox change
function handleRowCheckboxChange(checkbox) {
  const contactId = checkbox.dataset.contactId;

  if (checkbox.checked) {
    selectedContacts.add(contactId);
  } else {
    selectedContacts.delete(contactId);
  }

  updateBulkActionsUI();
}

// Handle select all checkbox
function handleSelectAll(event) {
  const checked = event.target.checked;
  const checkboxes = document.querySelectorAll('.row-checkbox');

  checkboxes.forEach(checkbox => {
    checkbox.checked = checked;
    const contactId = checkbox.dataset.contactId;

    if (checked) {
      selectedContacts.add(contactId);
    } else {
      selectedContacts.delete(contactId);
    }
  });

  updateBulkActionsUI();
}

// Update bulk actions UI
function updateBulkActionsUI() {
  const count = selectedContacts.size;
  const selectedCountEl = document.getElementById('selectedCount');
  const selectedCountText = document.getElementById('selectedCountText');
  const broadcastBtn = document.getElementById('broadcastBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

  if (count > 0) {
    selectedCountEl.style.display = 'block';
    selectedCountText.textContent = `${count} selected`;
    broadcastBtn.style.display = 'block';
    deleteSelectedBtn.style.display = 'block';
  } else {
    selectedCountEl.style.display = 'none';
    broadcastBtn.style.display = 'none';
    deleteSelectedBtn.style.display = 'none';
  }

  // Update select all checkbox state
  const selectAllCheckbox = document.getElementById('selectAll');
  const visibleCheckboxes = document.querySelectorAll('.row-checkbox');
  const allChecked = visibleCheckboxes.length > 0 &&
                     Array.from(visibleCheckboxes).every(cb => cb.checked);

  selectAllCheckbox.checked = allChecked;
}

// Handle search
function handleSearch(event) {
  const query = event.target.value.toLowerCase().trim();

  if (!query) {
    filteredContacts = [...allContacts];
  } else {
    filteredContacts = allContacts.filter(contact => {
      const name = (contact.name || '').toLowerCase();
      const phone = (contact.phone || '').toLowerCase();
      const email = (contact.email || '').toLowerCase();

      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
  }

  currentPage = 1;
  renderContacts();
}

// Handle tier filter
function handleTierFilter(event) {
  const tier = event.target.value;

  if (!tier) {
    filteredContacts = [...allContacts];
  } else {
    filteredContacts = allContacts.filter(contact =>
      (contact.tier || 'Standard') === tier
    );
  }

  currentPage = 1;
  renderContacts();
}

// Change page
function changePage(direction) {
  currentPage += direction;
  renderContacts();
}

// Download CSV template
function downloadCSVTemplate() {
  const csvContent = `name,phone,email,tier
John Tan,6591234567,john@example.com,VIP
Mary Lee,6598765432,mary@example.com,Premium
David Wong,6512345678,david@example.com,Standard`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'contacts_template.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showNotification('CSV template downloaded', 'success');
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
let csvData = null;
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
  const lines = data.trim().split('\n').slice(0, 6);
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

// Switch tabs
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

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
    <input type="text" placeholder="Phone (65XXXXXXXX)" class="contact-phone" required>
    <input type="email" placeholder="Email (optional)" class="contact-email">
    <select class="contact-tier">
      <option value="Standard">Standard</option>
      <option value="Premium">Premium</option>
      <option value="VIP">VIP</option>
    </select>
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

  const rows = document.querySelectorAll('.contact-row');
  const contacts = [];

  for (const row of rows) {
    const name = row.querySelector('.contact-name').value;
    const phone = row.querySelector('.contact-phone').value;
    const email = row.querySelector('.contact-email').value;
    const tier = row.querySelector('.contact-tier').value;

    if (phone) {
      contacts.push({
        name: name || '',
        phone: phone.replace(/\s+/g, ''),
        email: email || '',
        tier: tier || 'Standard',
        custom_fields: {}
      });
    }
  }

  if (contacts.length === 0) {
    showNotification('Please add at least one contact', 'error');
    return;
  }

  try {
    const response = await fetch('/api/broadcast-contacts/create-list', {
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
      await loadAllContacts();
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
    const response = await fetch('/api/broadcast-contacts/import-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csv_data: csvData,
        list_name: listName,
        description: ''
      })
    });

    const result = await response.json();

    if (result.success) {
      const message = result.message || `Successfully imported ${result.data.count} contacts`;
      showNotification(message, 'success');
      closeCreateModal();
      await loadAllContacts();
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
        list_name: listName,
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        range: range
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Successfully synced ${result.data.total_count} contacts`, 'success');
      closeCreateModal();
      await loadAllContacts();
    } else {
      showNotification(result.error || 'Failed to sync from Google Sheets', 'error');
    }
  } catch (error) {
    console.error('Error syncing from Google Sheets:', error);
    showNotification('Error syncing from Google Sheets', 'error');
  }
}

// Open edit modal
function openEditModal(contactId) {
  const contact = allContacts.find(c => c.id === contactId);

  if (!contact) {
    showNotification('Contact not found', 'error');
    return;
  }

  document.getElementById('editContactId').value = contact.id;
  document.getElementById('editName').value = contact.name || '';
  document.getElementById('editPhone').value = contact.phone || '';
  document.getElementById('editEmail').value = contact.email || '';
  document.getElementById('editTier').value = contact.tier || 'Standard';

  document.getElementById('editModal').classList.add('active');
}

// Close edit modal
function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  document.getElementById('editForm').reset();
}

// Handle edit form submission
async function handleEditSubmit(e) {
  e.preventDefault();

  const contactId = document.getElementById('editContactId').value;
  const name = document.getElementById('editName').value;
  const phone = document.getElementById('editPhone').value;
  const email = document.getElementById('editEmail').value;
  const tier = document.getElementById('editTier').value;

  try {
    const response = await fetch(`/api/broadcast-contacts/${contactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone: phone.replace(/\s+/g, ''),
        email,
        tier
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Contact updated successfully', 'success');
      closeEditModal();
      await loadAllContacts();
    } else {
      showNotification(result.error || 'Failed to update contact', 'error');
    }
  } catch (error) {
    console.error('Error updating contact:', error);
    showNotification('Error updating contact', 'error');
  }
}

// Handle delete contact
async function handleDeleteContact(contactId) {
  if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`/api/broadcast-contacts/${contactId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Contact deleted successfully', 'success');
      await loadAllContacts();
    } else {
      showNotification(result.error || 'Failed to delete contact', 'error');
    }
  } catch (error) {
    console.error('Error deleting contact:', error);
    showNotification('Error deleting contact', 'error');
  }
}

// Handle delete selected contacts
async function handleDeleteSelected() {
  if (selectedContacts.size === 0) {
    showNotification('No contacts selected', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to delete ${selectedContacts.size} contacts? This action cannot be undone.`)) {
    return;
  }

  try {
    const contactIds = Array.from(selectedContacts);
    const response = await fetch('/api/broadcast-contacts/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: contactIds })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Successfully deleted ${selectedContacts.size} contacts`, 'success');
      selectedContacts.clear();
      await loadAllContacts();
    } else {
      showNotification(result.error || 'Failed to delete contacts', 'error');
    }
  } catch (error) {
    console.error('Error deleting contacts:', error);
    showNotification('Error deleting contacts', 'error');
  }
}

// Open broadcast modal
function openBroadcastModal() {
  if (selectedContacts.size === 0) {
    showNotification('No contacts selected', 'error');
    return;
  }

  const selectedContactsList = document.getElementById('selectedContactsList');
  const contacts = allContacts.filter(c => selectedContacts.has(c.id));

  selectedContactsList.innerHTML = `
    <p style="margin-bottom: 0.5rem; font-weight: 500; color: #334155;">
      ${selectedContacts.size} contact${selectedContacts.size > 1 ? 's' : ''} selected:
    </p>
    ${contacts.map(c => `
      <div style="padding: 0.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
        <span>${escapeHtml(c.name || 'Unknown')}</span>
        <span style="color: #64748b; font-family: monospace;">${escapeHtml(c.phone)}</span>
      </div>
    `).join('')}
  `;

  document.getElementById('broadcastModal').classList.add('active');
}

// Close broadcast modal
function closeBroadcastModal() {
  document.getElementById('broadcastModal').classList.remove('active');
  document.getElementById('broadcastForm').reset();
}

// Handle broadcast form submission
async function handleBroadcastSubmit(e) {
  e.preventDefault();

  const message = document.getElementById('broadcastMessage').value;
  const imageUrl = document.getElementById('broadcastImage').value;
  const batchSize = parseInt(document.getElementById('batchSize').value) || 10;
  const delayBetween = parseInt(document.getElementById('delayBetween').value) || 7;

  const contacts = allContacts.filter(c => selectedContacts.has(c.id));

  try {
    const response = await fetch('/api/broadcast/interest-rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacts: contacts.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone
        })),
        message,
        image_url: imageUrl,
        batch_size: batchSize,
        delay_between_messages: delayBetween * 1000
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Broadcast started! Sending to ${contacts.length} contacts`, 'success');
      closeBroadcastModal();
      selectedContacts.clear();
      updateBulkActionsUI();
    } else {
      showNotification(result.error || 'Failed to start broadcast', 'error');
    }
  } catch (error) {
    console.error('Error starting broadcast:', error);
    showNotification('Error starting broadcast', 'error');
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
