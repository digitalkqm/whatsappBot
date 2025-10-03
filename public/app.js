// Dashboard JavaScript

let ws = null;
let reconnectInterval = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loaded');

  // Setup WebSocket for real-time updates
  connectWebSocket();

  // Setup button event listeners
  setupEventListeners();

  // Initial data fetch
  fetchHealthStatus();
  fetchQRCode();

  // Poll for updates every 10 seconds
  setInterval(fetchHealthStatus, 10000);
});

// WebSocket connection for real-time updates
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      updateConnectionStatus('connected');

      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateConnectionStatus('error');
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      updateConnectionStatus('disconnected');

      // Attempt to reconnect
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 5000);
      }
    };
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    updateConnectionStatus('error');
  }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
  if (data.type === 'qr') {
    displayQRCode(data.qr);
  } else if (data.type === 'status') {
    updateStatus(data.status);
  } else if (data.type === 'workflow') {
    updateWorkflows(data.workflows);
  }
}

// Update connection status badge
function updateConnectionStatus(status) {
  const badge = document.getElementById('connectionStatus');
  const statusText = badge.querySelector('.status-text');

  badge.className = 'status-badge';

  if (status === 'connected') {
    badge.classList.add('connected');
    statusText.textContent = 'Connected';
  } else if (status === 'disconnected') {
    badge.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
  } else if (status === 'error') {
    badge.classList.add('disconnected');
    statusText.textContent = 'Error';
  }
}

// Setup button event listeners
function setupEventListeners() {
  document.getElementById('refreshQR').addEventListener('click', fetchQRCode);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('toggleBreak').addEventListener('click', toggleBreak);
  document.getElementById('saveSession').addEventListener('click', saveSession);
  document.getElementById('clearSession').addEventListener('click', clearSession);
  document.getElementById('restartBot').addEventListener('click', restartBot);
}

// Fetch health status
async function fetchHealthStatus() {
  try {
    const response = await fetch('/health');
    const data = await response.json();

    updateStatus(data);
    updateLastUpdate();
  } catch (error) {
    console.error('Failed to fetch health status:', error);
  }
}

// Fetch QR code
async function fetchQRCode() {
  try {
    const response = await fetch('/qr-code');
    const data = await response.json();

    if (data.qr) {
      displayQRCode(data.qr);
    } else if (data.authenticated) {
      hideQRCode();
      showMessage('Already authenticated', 'success');
    }
  } catch (error) {
    console.error('Failed to fetch QR code:', error);
  }
}

// Display QR code
function displayQRCode(qrData) {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.src = qrData;
  image.style.display = 'block';
  placeholder.style.display = 'none';
}

// Hide QR code
function hideQRCode() {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.innerHTML = '<p>✅ Authenticated</p>';
}

// Update status display
function updateStatus(data) {
  // WhatsApp state
  const stateEl = document.getElementById('whatsappState');
  stateEl.textContent = data.whatsapp?.state || 'Unknown';
  stateEl.style.color = data.whatsapp?.state === 'CONNECTED' ? '#28a745' : '#dc3545';

  // Uptime
  if (data.uptime?.readable) {
    document.getElementById('uptime').textContent = data.uptime.readable;
  }

  // Human behavior stats
  if (data.humanBehavior) {
    const hb = data.humanBehavior;
    document.getElementById('messagesHourly').textContent = hb.messageCount?.hourly || 0;
    document.getElementById('messagesDaily').textContent = hb.messageCount?.daily || 0;
    document.getElementById('activeHours').textContent = hb.isActiveHours ? 'Yes' : 'No';
    document.getElementById('onBreak').textContent = hb.isOnBreak ? 'Yes ⏸️' : 'No';
  }

  // System info
  if (data.system) {
    document.getElementById('memoryRss').textContent = data.system.memory?.rss || '--';
    document.getElementById('memoryHeap').textContent = data.system.memory?.heapUsed || '--';
    document.getElementById('nodeVersion').textContent = data.system.nodejs || '--';
  }

  if (data.version) {
    document.getElementById('botVersion').textContent = data.version;
  }
}

// Update workflows display
function updateWorkflows(workflows) {
  const container = document.getElementById('workflowsContainer');

  if (!workflows || workflows.length === 0) {
    container.innerHTML = '<p class="empty-state">No active workflows</p>';
    return;
  }

  container.innerHTML = workflows.map(wf => `
    <div class="workflow-item ${wf.status}">
      <div class="workflow-name">${wf.name}</div>
      <div class="workflow-status">
        Status: ${wf.status} | Started: ${new Date(wf.startedAt).toLocaleString()}
      </div>
    </div>
  `).join('');
}

// Update last update timestamp
function updateLastUpdate() {
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
}

// Logout
async function logout() {
  if (!confirm('Are you sure you want to logout? This will disconnect the WhatsApp session.')) {
    return;
  }

  try {
    const response = await fetch('/clear-session', { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      showMessage('Session cleared. Please restart the bot.', 'success');
    } else {
      showMessage('Failed to clear session', 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Toggle break mode
async function toggleBreak() {
  try {
    const response = await fetch('/toggle-break', { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      showMessage(data.message, 'success');
      fetchHealthStatus();
    } else {
      showMessage('Failed to toggle break mode', 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Save session
async function saveSession() {
  try {
    const response = await fetch('/save-session', { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      showMessage('Session saved successfully', 'success');
    } else {
      showMessage('Failed to save session', 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Clear session
async function clearSession() {
  if (!confirm('Are you sure? This will clear the stored session and require re-authentication.')) {
    return;
  }

  try {
    const response = await fetch('/clear-session', { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      showMessage('Session cleared', 'success');
      setTimeout(() => window.location.reload(), 2000);
    } else {
      showMessage('Failed to clear session', 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Restart bot
async function restartBot() {
  if (!confirm('Restart the bot? This may take a few moments.')) {
    return;
  }

  showMessage('Restart functionality requires server-side implementation', 'info');
}

// Show message (simple alert for now, could be enhanced with toast notifications)
function showMessage(message, type) {
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  alert(`${icon} ${message}`);
}
