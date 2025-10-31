// Dashboard JavaScript

let ws = null;
let reconnectInterval = null;
let qrExpiryTimer = null;
let qrGeneratedTime = null;
const QR_EXPIRY_SECONDS = 60; // QR codes typically expire in 60 seconds

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

  // Check QR code status every 3 seconds
  setInterval(checkQRStatus, 3000);
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
    console.log('Received QR code via WebSocket', data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'no timestamp');
    displayQRCode(data.qr);
  } else if (data.type === 'authenticated') {
    console.log('Authentication in progress...');
    showAuthenticating();
  } else if (data.type === 'ready') {
    console.log('Authentication successful!');
    showAuthenticationSuccess();
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
  const refreshBtn = document.getElementById('refreshQR');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchQRCode);
  }

  // Optional buttons (only add listeners if they exist)
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  const toggleBreakBtn = document.getElementById('toggleBreak');
  if (toggleBreakBtn) toggleBreakBtn.addEventListener('click', toggleBreak);

  const saveSessionBtn = document.getElementById('saveSession');
  if (saveSessionBtn) saveSessionBtn.addEventListener('click', saveSession);

  const clearSessionBtn = document.getElementById('clearSession');
  if (clearSessionBtn) clearSessionBtn.addEventListener('click', clearSession);

  const restartBotBtn = document.getElementById('restartBot');
  if (restartBotBtn) restartBotBtn.addEventListener('click', restartBot);
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
  showQRLoading();

  try {
    const response = await fetch('/qr-code');
    const data = await response.json();

    if (data.qr) {
      displayQRCode(data.qr);
    } else if (data.authenticated) {
      showAuthenticationSuccess();
    } else {
      showQRWaiting();
    }
  } catch (error) {
    console.error('Failed to fetch QR code:', error);
    showQRError('Failed to fetch QR code. Retrying...');
  }
}

// Check QR status periodically
async function checkQRStatus() {
  try {
    const response = await fetch('/qr-code');
    const data = await response.json();

    if (data.authenticated) {
      showAuthenticationSuccess();
    } else if (data.state === 'CONNECTED') {
      showAuthenticationSuccess();
    } else if (data.qr) {
      // New QR code available - update display
      const currentQR = document.getElementById('qrCodeImage').src;
      if (currentQR !== data.qr) {
        console.log('New QR code detected, updating display');
        displayQRCode(data.qr);
      }
    }
  } catch (error) {
    // Silent fail for background checks
  }
}

// Display QR code
function displayQRCode(qrData) {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.src = qrData;
  image.style.display = 'block';
  placeholder.style.display = 'none';

  // Track QR generation time and start expiry timer
  qrGeneratedTime = Date.now();
  startQRExpiryTimer();

  // Update instructions to show active state
  updateQRInstructions('active');
}

// Show QR loading state
function showQRLoading() {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.className = 'qr-placeholder loading';
  placeholder.innerHTML = `
    <div class="qr-status">
      <div class="spinner"></div>
      <p>Generating QR code...</p>
    </div>
  `;

  updateQRInstructions('loading');
}

// Show QR waiting state
function showQRWaiting() {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.className = 'qr-placeholder waiting';
  placeholder.innerHTML = `
    <div class="qr-status">
      <div class="spinner"></div>
      <p>Waiting for QR code...</p>
    </div>
  `;

  updateQRInstructions('waiting');
}

// Show QR expired state
function showQRExpired() {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.className = 'qr-placeholder expired';
  placeholder.innerHTML = `
    <div class="qr-status">
      <div class="expired-icon">⏰</div>
      <p>QR Code Expired</p>
      <button class="btn btn-primary" onclick="fetchQRCode()" style="margin-top: 15px;">
        🔄 Generate New Code
      </button>
    </div>
  `;

  updateQRInstructions('expired');
  clearQRExpiryTimer();
}

// Show QR error state
function showQRError(message) {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.className = 'qr-placeholder error';
  placeholder.innerHTML = `
    <div class="qr-status">
      <div class="error-icon">❌</div>
      <p>${message}</p>
    </div>
  `;

  updateQRInstructions('error');
}

// Show authenticating state
function showAuthenticating() {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.className = 'qr-placeholder authenticating';
  placeholder.innerHTML = `
    <div class="qr-status">
      <div class="spinner success"></div>
      <p>Authenticating...</p>
      <small>Please wait while we connect</small>
    </div>
  `;

  updateQRInstructions('authenticating');
  clearQRExpiryTimer();
}

// Show authentication success
function showAuthenticationSuccess() {
  const placeholder = document.getElementById('qrPlaceholder');
  const image = document.getElementById('qrCodeImage');

  image.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.className = 'qr-placeholder success';
  placeholder.innerHTML = `
    <div class="qr-status">
      <div class="success-icon">✅</div>
      <p>Successfully Connected!</p>
      <small>Your WhatsApp bot is ready</small>
    </div>
  `;

  updateQRInstructions('success');
  clearQRExpiryTimer();

  // Trigger confetti or celebration animation
  celebrateSuccess();
}

// Update QR instructions based on state
function updateQRInstructions(state) {
  const instructions = document.querySelector('.qr-instructions');

  const messages = {
    loading: '<h3>⏳ Generating QR Code...</h3><p>Please wait a moment while we prepare your authentication code.</p>',
    waiting: '<h3>⏳ Waiting...</h3><p>The QR code will appear shortly. Make sure WhatsApp is open on your phone.</p>',
    active: '<h3>📱 Scan to Connect:</h3><ol><li>Open WhatsApp on your phone</li><li>Tap <strong>Menu</strong> or <strong>Settings</strong></li><li>Tap <strong>Linked Devices</strong></li><li>Tap <strong>Link a Device</strong></li><li>Scan this QR code with your phone</li></ol>',
    expired: '<h3>⏰ QR Code Expired</h3><p>QR codes expire after 60 seconds for security. Click the button above to generate a new one.</p>',
    error: '<h3>❌ Error</h3><p>Something went wrong. We\'ll automatically retry in a moment.</p>',
    authenticating: '<h3>🔐 Authenticating...</h3><p>Great! We detected your scan. Connecting to WhatsApp servers...</p>',
    success: '<h3>✅ Connected!</h3><p>Your WhatsApp bot is now active and ready to process messages.</p>'
  };

  instructions.innerHTML = messages[state] || messages.waiting;
}

// QR expiry timer management
function startQRExpiryTimer() {
  clearQRExpiryTimer();

  qrExpiryTimer = setTimeout(() => {
    console.log('QR code expired, fetching new one...');
    showQRExpired();
    // Automatically fetch a new QR code after expiry
    setTimeout(fetchQRCode, 2000); // Wait 2 seconds before fetching new QR
  }, QR_EXPIRY_SECONDS * 1000);
}

function clearQRExpiryTimer() {
  if (qrExpiryTimer) {
    clearTimeout(qrExpiryTimer);
    qrExpiryTimer = null;
  }
}

// Celebration animation
function celebrateSuccess() {
  // Simple celebration - could be enhanced with confetti library
  const container = document.querySelector('.qr-container');
  container.classList.add('celebrate');

  setTimeout(() => {
    container.classList.remove('celebrate');
  }, 2000);
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

// Copy valuation template to clipboard
function copyTemplate() {
  const template = document.getElementById('valuationTemplate');
  const text = template.textContent;

  // Use modern clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = '✅ Copied!';
      btn.style.background = '#10b981';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

// Fallback copy method for older browsers
function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
    alert('✅ Template copied to clipboard!');
  } catch (err) {
    alert('❌ Failed to copy. Please copy manually.');
  }

  document.body.removeChild(textarea);
}
