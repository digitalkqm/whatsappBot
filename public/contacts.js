// Enhanced Contact Manager JavaScript

let allContacts = [];
let filteredContacts = [];
let selectedContacts = new Set();
let currentPage = 1;
const contactsPerPage = 50;

// WebSocket for real-time broadcast updates
let broadcastWs = null;

// Track uploaded image URL for broadcast
let uploadedImageUrl = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllContacts();
  setupEventListeners();
  setupCSVUpload();
  setupBroadcastWebSocket();
  checkForActiveBroadcast(); // Check for in-progress broadcasts
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('createListBtn').addEventListener('click', () => openCreateModal());
  document
    .getElementById('downloadTemplateBtn')
    .addEventListener('click', () => downloadCSVTemplate());
  document.getElementById('manualForm').addEventListener('submit', handleManualSubmit);
  document.getElementById('csvForm').addEventListener('submit', handleCSVSubmit);
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

  // Pagination
  document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
  document.getElementById('nextPage').addEventListener('click', () => changePage(1));

  // Image upload handling
  document.getElementById('broadcastImageFile').addEventListener('change', handleImageSelect);
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
  tbody.innerHTML = pageContacts
    .map(
      contact => `
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
  `
    )
    .join('');

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

  if (count > 0) {
    selectedCountEl.style.display = 'block';
    selectedCountText.textContent = `${count} selected`;
    broadcastBtn.style.display = 'block';
  } else {
    selectedCountEl.style.display = 'none';
    broadcastBtn.style.display = 'none';
  }

  // Update select all checkbox state
  const selectAllCheckbox = document.getElementById('selectAll');
  const visibleCheckboxes = document.querySelectorAll('.row-checkbox');
  const allChecked =
    visibleCheckboxes.length > 0 && Array.from(visibleCheckboxes).every(cb => cb.checked);

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
    filteredContacts = allContacts.filter(contact => (contact.tier || 'Standard') === tier);
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

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleCSVFile(file);
    } else {
      showNotification('Please upload a CSV file', 'error');
    }
  });

  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleCSVFile(file);
  });
}

// Handle CSV file upload
let csvData = null;
async function handleCSVFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
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
      ${lines
        .map((line, index) => {
          const cells = line.split(',').map(c => c.trim());
          const tag = index === 0 ? 'th' : 'td';
          return `<tr>${cells.map(c => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`;
        })
        .join('')}
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
    ${contacts
      .map(
        c => `
      <div style="padding: 0.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
        <span>${escapeHtml(c.name || 'Unknown')}</span>
        <span style="color: #64748b; font-family: monospace;">${escapeHtml(c.phone)}</span>
      </div>
    `
      )
      .join('')}
  `;

  document.getElementById('broadcastModal').classList.add('active');
}

// Close broadcast modal
function closeBroadcastModal() {
  document.getElementById('broadcastModal').classList.remove('active');
  document.getElementById('broadcastForm').reset();
}

// Insert {name} placeholder at cursor position
function insertNamePlaceholder() {
  const textarea = document.getElementById('broadcastMessage');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;

  // Insert {name} at cursor position
  textarea.value = text.substring(0, start) + '{name}' + text.substring(end);

  // Move cursor after inserted text
  textarea.selectionStart = textarea.selectionEnd = start + 6;
  textarea.focus();
}

// Broadcast progress tracking
let currentBroadcastId = null;
let currentExecutionId = null;
let broadcastStatusInterval = null;
let broadcastContactsMap = new Map(); // Map of contact IDs to their info

// Setup WebSocket connection for broadcast updates
function setupBroadcastWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    broadcastWs = new WebSocket(wsUrl);

    broadcastWs.onopen = () => {
      console.log('Broadcast WebSocket connected');
    };

    broadcastWs.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type === 'broadcast_status') {
        handleBroadcastStatusUpdate(message.data);
      }
    };

    broadcastWs.onerror = error => {
      console.error('Broadcast WebSocket error:', error);
    };

    broadcastWs.onclose = () => {
      console.log('Broadcast WebSocket disconnected, reconnecting...');
      setTimeout(setupBroadcastWebSocket, 5000);
    };
  } catch (error) {
    console.error('Failed to create broadcast WebSocket:', error);
  }
}

// Handle real-time broadcast status updates
function handleBroadcastStatusUpdate(data) {
  // Only process if this is the current broadcast
  if (!currentBroadcastId || data.broadcast_id !== currentBroadcastId) {
    return;
  }

  console.log('Broadcast status update:', data);

  // Update summary metrics
  document.getElementById('sentContactsCount').textContent = data.sent;
  document.getElementById('failedContactsCount').textContent = data.failed;
  document.getElementById('progressPercentage').textContent = data.progress + '%';
  document.getElementById('progressBar').style.width = data.progress + '%';

  // Update status message
  if (data.status === 'completed') {
    document.getElementById('broadcastStatusMessage').textContent =
      `✅ Broadcast complete! ${data.sent} sent, ${data.failed} failed`;
    document.getElementById('closeProgressBtn').disabled = false;
  } else if (data.status === 'on_break') {
    const breakHours = data.break_duration_ms ? (data.break_duration_ms / 3600000).toFixed(1) : '?';
    document.getElementById('broadcastStatusMessage').innerHTML =
      `☕ <strong>Taking a break...</strong><br><small style="color: #64748b;">${data.break_reason || `Pausing for ${breakHours} hours to avoid detection`}</small>`;
  } else {
    document.getElementById('broadcastStatusMessage').textContent =
      `Sending messages... ${data.current_index}/${data.total}`;
  }

  // Update individual contact status in table
  if (data.current_contact) {
    const row = document.querySelector(
      `#broadcastStatusTable tr[data-contact-id="${data.current_contact.id}"]`
    );
    if (row) {
      const statusCell = row.querySelector('.status-badge');
      if (data.current_contact.status === 'sent') {
        statusCell.outerHTML = '<span class="status-badge status-sent">✅ Sent</span>';
      } else if (data.current_contact.status === 'failed') {
        statusCell.outerHTML = '<span class="status-badge status-failed">❌ Failed</span>';
      }
    }
  }
}

// Check for active broadcasts on page load (recovery)
async function checkForActiveBroadcast() {
  try {
    // Check if there's a stored broadcast ID in localStorage
    const storedBroadcastId = localStorage.getItem('active_broadcast_id');
    const storedExecutionId = localStorage.getItem('active_execution_id');

    if (!storedBroadcastId && !storedExecutionId) {
      return;
    }

    // Query the broadcast status
    const id = storedBroadcastId || storedExecutionId;
    const response = await fetch(`/api/broadcast/status/${id}`);
    const result = await response.json();

    if (result.success && result.data.summary.status === 'running') {
      // Broadcast is still running, show progress modal
      console.log('Recovering active broadcast:', result.data.summary);

      currentBroadcastId = result.data.summary.broadcast_id;
      currentExecutionId = result.data.summary.execution_id;

      // Reconstruct contacts info from messages
      const contacts = result.data.messages.map(msg => ({
        id: msg.contact_id,
        name: msg.recipient_name,
        phone: msg.recipient_phone
      }));

      // Store contacts in map for status updates
      contacts.forEach(c => broadcastContactsMap.set(c.id, c));

      // Show progress modal with current state
      showBroadcastProgress(contacts, result.data.summary);
    } else {
      // Broadcast completed or not found, clean up storage
      localStorage.removeItem('active_broadcast_id');
      localStorage.removeItem('active_execution_id');
    }
  } catch (error) {
    console.error('Error checking for active broadcast:', error);
    localStorage.removeItem('active_broadcast_id');
    localStorage.removeItem('active_execution_id');
  }
}

// Handle broadcast form submission
async function handleBroadcastSubmit(e) {
  e.preventDefault();

  const message = document.getElementById('broadcastMessage').value;
  const delayMode = document.querySelector('input[name="delayMode"]:checked').value;
  const breakMode = document.querySelector('input[name="breakMode"]:checked').value;
  const notificationContact = document.getElementById('notificationContact').value.trim();
  const imageFile = document.getElementById('broadcastImageFile').files[0];

  const contacts = allContacts.filter(c => selectedContacts.has(c.id));

  try {
    let imageUrl = uploadedImageUrl; // Use already uploaded image URL

    // If a new file is selected but not uploaded yet, upload it first
    if (imageFile && !uploadedImageUrl) {
      showNotification('Uploading image...', 'info');
      const uploadResult = await uploadImageToServer(imageFile);

      if (uploadResult.success) {
        imageUrl = uploadResult.url;
      } else {
        showNotification('Image upload failed: ' + uploadResult.error, 'error');
        return; // Stop broadcast if image upload fails
      }
    }

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
        delay_mode: delayMode,
        break_mode: breakMode,
        notification_contact: notificationContact || null
      })
    });

    const result = await response.json();

    if (result.success) {
      currentBroadcastId = result.data.broadcast_id;
      currentExecutionId = result.data.execution_id;

      // Store in localStorage for recovery after page refresh
      localStorage.setItem('active_broadcast_id', currentBroadcastId);
      localStorage.setItem('active_execution_id', currentExecutionId);

      // Store contacts in map
      contacts.forEach(c => broadcastContactsMap.set(c.id, c));

      closeBroadcastModal();
      showBroadcastProgress(contacts);
      selectedContacts.clear();
      updateBulkActionsUI();

      // Clear uploaded image for next broadcast
      uploadedImageUrl = null;
    } else {
      showNotification(result.error || 'Failed to start broadcast', 'error');
    }
  } catch (error) {
    console.error('Error starting broadcast:', error);
    showNotification('Error starting broadcast', 'error');
  }
}

// Show broadcast progress modal
function showBroadcastProgress(contacts, initialStatus = null) {
  const modal = document.getElementById('broadcastProgressModal');
  modal.classList.add('active');

  // Initialize progress (use initialStatus if recovering from page refresh)
  if (initialStatus) {
    document.getElementById('totalContactsCount').textContent = initialStatus.total;
    document.getElementById('sentContactsCount').textContent = initialStatus.sent;
    document.getElementById('failedContactsCount').textContent = initialStatus.failed;
    document.getElementById('progressPercentage').textContent = initialStatus.progress + '%';
    document.getElementById('progressBar').style.width = initialStatus.progress + '%';

    if (initialStatus.status === 'completed') {
      document.getElementById('broadcastStatusMessage').textContent =
        `✅ Broadcast complete! ${initialStatus.sent} sent, ${initialStatus.failed} failed`;
      document.getElementById('closeProgressBtn').disabled = false;
    } else {
      document.getElementById('broadcastStatusMessage').textContent =
        `Sending messages... ${initialStatus.current_index}/${initialStatus.total}`;
      document.getElementById('closeProgressBtn').disabled = true;
    }
  } else {
    document.getElementById('totalContactsCount').textContent = contacts.length;
    document.getElementById('sentContactsCount').textContent = '0';
    document.getElementById('failedContactsCount').textContent = '0';
    document.getElementById('progressPercentage').textContent = '0%';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('broadcastStatusMessage').textContent = 'Starting broadcast...';
    document.getElementById('closeProgressBtn').disabled = true;
  }

  // Populate status table
  const tbody = document.getElementById('broadcastStatusTable');
  tbody.innerHTML = contacts
    .map(c => {
      // If recovering, determine status from initialStatus
      let statusBadge = '<span class="status-badge status-pending">⏳ Pending</span>';

      if (initialStatus && initialStatus.current_index > 0) {
        // Try to determine status from messages (not available here, but will be updated via WebSocket)
        statusBadge = '<span class="status-badge status-pending">⏳ Pending</span>';
      }

      return `
      <tr data-contact-id="${c.id}">
        <td>${escapeHtml(c.name || 'Unknown')}</td>
        <td>${escapeHtml(c.phone)}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
    })
    .join('');

  // Fetch detailed status if recovering (to populate individual message statuses)
  if (initialStatus && currentExecutionId) {
    updateTableStatusFromAPI(currentExecutionId);
  }
}

// Update table with detailed message status from API (used when recovering)
async function updateTableStatusFromAPI(executionId) {
  try {
    const response = await fetch(`/api/broadcast/status/${executionId}`);
    const result = await response.json();

    if (result.success && result.data.messages) {
      result.data.messages.forEach(msg => {
        const row = document.querySelector(
          `#broadcastStatusTable tr[data-contact-id="${msg.contact_id}"]`
        );
        if (row) {
          const statusCell = row.querySelector('td:last-child');
          let statusBadge = '';

          switch (msg.status) {
            case 'sent':
              statusBadge = '<span class="status-badge status-sent">✅ Sent</span>';
              break;
            case 'failed':
              statusBadge = '<span class="status-badge status-failed">❌ Failed</span>';
              break;
            case 'sending':
              statusBadge = '<span class="status-badge status-sending">🔄 Sending</span>';
              break;
            default:
              statusBadge = '<span class="status-badge status-pending">⏳ Pending</span>';
          }

          statusCell.innerHTML = statusBadge;
        }
      });
    }
  } catch (error) {
    console.error('Error fetching detailed status:', error);
  }
}

// Close broadcast progress modal
function closeBroadcastProgress() {
  const modal = document.getElementById('broadcastProgressModal');
  modal.classList.remove('active');

  if (broadcastStatusInterval) {
    clearInterval(broadcastStatusInterval);
    broadcastStatusInterval = null;
  }

  // Clear broadcast tracking
  currentBroadcastId = null;
  currentExecutionId = null;
  broadcastContactsMap.clear();

  // Clear localStorage
  localStorage.removeItem('active_broadcast_id');
  localStorage.removeItem('active_execution_id');
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

// ===== IMAGE UPLOAD FUNCTIONS =====

// Handle image file selection
async function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    showNotification('Image file is too large. Maximum size is 5MB.', 'error');
    event.target.value = ''; // Clear the input
    return;
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showNotification('Please select a valid image file.', 'error');
    event.target.value = ''; // Clear the input
    return;
  }

  // Show file name
  document.getElementById('imageFileName').textContent = file.name;
  document.getElementById('clearImageBtn').style.display = 'inline-block';

  // Show preview
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('imagePreview').style.display = 'block';
  };
  reader.readAsDataURL(file);

  // Auto-upload the image
  await uploadImageToServer(file);
}

// Upload image to server
async function uploadImageToServer(file) {
  const formData = new FormData();
  formData.append('image', file);

  const uploadProgress = document.getElementById('uploadProgress');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const uploadStatus = document.getElementById('uploadStatus');

  try {
    uploadProgress.style.display = 'block';
    uploadStatus.textContent = 'Uploading...';
    uploadProgressBar.style.width = '30%';

    const response = await fetch('/api/upload/image', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      uploadedImageUrl = result.url;
      uploadProgressBar.style.width = '100%';
      uploadStatus.textContent = 'Upload complete!';
      uploadStatus.style.color = '#16a34a';

      setTimeout(() => {
        uploadProgress.style.display = 'none';
        uploadProgressBar.style.width = '0%';
        uploadStatus.style.color = '#64748b';
      }, 2000);

      showNotification('Image uploaded successfully!', 'success');
      return { success: true, url: result.url };
    } else {
      uploadProgress.style.display = 'none';
      showNotification('Image upload failed: ' + result.error, 'error');
      return { success: false, error: result.error };
    }
  } catch (error) {
    uploadProgress.style.display = 'none';
    console.error('Upload error:', error);
    showNotification('Image upload failed: ' + error.message, 'error');
    return { success: false, error: error.message };
  }
}

// Clear selected image
function clearSelectedImage() {
  document.getElementById('broadcastImageFile').value = '';
  document.getElementById('imageFileName').textContent = 'No file chosen';
  document.getElementById('clearImageBtn').style.display = 'none';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('previewImg').src = '';
  uploadedImageUrl = null;
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
