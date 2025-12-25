// Dashboard JavaScript

let ws = null;
let reconnectInterval = null;
let qrExpiryTimer = null;
let qrGeneratedTime = null;
let currentQRGeneratedAt = null; // Track backend QR generation timestamp for deduplication
const QR_EXPIRY_SECONDS = 25; // WhatsApp QR codes expire in ~20-30 seconds
let totalMessageCount = 0; // Track total messages during session

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loaded');

  // Check if previously authenticated and restore UI state
  const wasAuthenticated = localStorage.getItem('whatsapp_authenticated') === 'true';

  if (wasAuthenticated) {
    console.log('Restoring authenticated state from localStorage');
    // Show logging section immediately for better UX
    const qrSection = document.getElementById('qrSection');
    const loggingSection = document.getElementById('loggingSection');

    if (qrSection) qrSection.style.display = 'none';
    if (loggingSection) loggingSection.style.display = 'block';
  }

  // Setup WebSocket for real-time updates
  connectWebSocket();

  // Setup button event listeners
  setupEventListeners();

  // Initial data fetch
  fetchHealthStatus();
  fetchQRCode();
  fetchWorkflows();

  // Poll for updates every 10 seconds
  setInterval(fetchHealthStatus, 10000);

  // Check QR code status every 3 seconds
  setInterval(checkQRStatus, 3000);

  // Poll for workflow updates every 5 seconds
  setInterval(fetchWorkflows, 5000);
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

    ws.onmessage = event => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    ws.onerror = error => {
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
    console.log(
      'Received QR code via WebSocket',
      data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : 'no generatedAt'
    );

    // Only update if this is a newer QR code
    if (data.generatedAt && data.generatedAt !== currentQRGeneratedAt) {
      console.log('New QR code detected, updating display');
      currentQRGeneratedAt = data.generatedAt;

      // Clear authentication state - re-authentication needed
      localStorage.removeItem('whatsapp_authenticated');
      console.log('Authentication state cleared - re-authentication required');

      // Show QR section if it's hidden (re-authentication needed)
      const qrSection = document.getElementById('qrSection');
      const loggingSection = document.getElementById('loggingSection');

      if (qrSection && qrSection.style.display === 'none') {
        qrSection.style.display = 'block';
        if (loggingSection) {
          loggingSection.style.display = 'none';
        }
      }

      // Hide logout button when QR is shown
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = 'none';

      displayQRCode(data.qr);
    } else {
      console.log('QR code unchanged (same generatedAt), skipping display update');
    }
  } else if (data.type === 'authenticated') {
    console.log('Authentication in progress...');
    showAuthenticating();
  } else if (data.type === 'ready') {
    console.log('Authentication successful!');
    showAuthenticationSuccess();
  } else if (data.type === 'logout') {
    console.log('Logout event received:', data.message);
    handleLogoutEvent();
  } else if (data.type === 'status') {
    updateStatus(data.status);
  } else if (data.type === 'workflow') {
    updateWorkflows(data.workflows);
  } else if (data.type === 'log') {
    addLogEntry(data);
  }
}

// Update connection status badge (deprecated - status badge removed from UI)
function updateConnectionStatus(status) {
  // Function kept for backward compatibility but does nothing
  // Status badge was removed as it was confusing (showed WebSocket connection, not WhatsApp auth)
  console.log('WebSocket status:', status);
}

// Setup button event listeners
function setupEventListeners() {
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

  const clearLogsBtn = document.getElementById('clearLogs');
  if (clearLogsBtn) clearLogsBtn.addEventListener('click', clearLogs);
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
  // Don't show loading immediately - check auth status first
  try {
    const response = await fetch('/qr-code');
    const data = await response.json();

    // Check authentication status first
    if (data.authenticated || data.state === 'CONNECTED') {
      currentQRGeneratedAt = null;
      showAuthenticationSuccess();
    } else if (data.qr && data.generatedAt) {
      // Only display if it's a new QR code
      if (data.generatedAt !== currentQRGeneratedAt) {
        currentQRGeneratedAt = data.generatedAt;
        displayQRCode(data.qr);
      } else if (data.isStale) {
        // Same QR but stale, show waiting for new one
        showQRWaiting();
      }
    } else if (data.qr) {
      // Fallback for QR without generatedAt (shouldn't happen)
      displayQRCode(data.qr);
    } else {
      showQRWaiting();
    }
  } catch (error) {
    console.error('Failed to fetch QR code:', error);
    showQRError('Failed to fetch QR code. Retrying...');
  }
}

// Fetch workflows
async function fetchWorkflows() {
  try {
    const response = await fetch('/workflows');
    const data = await response.json();

    if (data.active) {
      updateWorkflows(data.active);
    }
  } catch (error) {
    console.error('Failed to fetch workflows:', error);
  }
}

// Check QR status periodically
async function checkQRStatus() {
  try {
    const response = await fetch('/qr-code');
    const data = await response.json();

    if (data.authenticated) {
      currentQRGeneratedAt = null; // Clear tracking on auth
      showAuthenticationSuccess();
    } else if (data.state === 'CONNECTED') {
      currentQRGeneratedAt = null; // Clear tracking on auth
      showAuthenticationSuccess();
    } else if (data.qr) {
      // Need to re-authenticate - show QR section
      const qrSection = document.getElementById('qrSection');
      const loggingSection = document.getElementById('loggingSection');

      if (qrSection && qrSection.style.display === 'none') {
        qrSection.style.display = 'block';
        if (loggingSection) {
          loggingSection.style.display = 'none';
        }
      }

      // Check if this is a new QR code by comparing generatedAt timestamp
      if (data.generatedAt && data.generatedAt !== currentQRGeneratedAt) {
        console.log('New QR code detected via polling, updating display');
        currentQRGeneratedAt = data.generatedAt;
        displayQRCode(data.qr);
      } else if (data.isStale) {
        // QR is stale but no new one available yet, show waiting state
        console.log('QR code is stale, waiting for new one...');
        showQRWaiting();
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
  // Clear QR tracking on successful auth
  currentQRGeneratedAt = null;
  clearQRExpiryTimer();

  // Save authentication state to localStorage for persistence
  localStorage.setItem('whatsapp_authenticated', 'true');
  console.log('Authentication state saved to localStorage');

  // Hide QR code section
  const qrSection = document.getElementById('qrSection');
  if (qrSection) {
    qrSection.style.display = 'none';
  }

  // Show logging section
  const loggingSection = document.getElementById('loggingSection');
  if (loggingSection) {
    loggingSection.style.display = 'block';
  }

  // Show logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.style.display = 'inline-block';
  }

  clearQRExpiryTimer();

  // Trigger confetti or celebration animation
  celebrateSuccess();
}

// Update QR instructions based on state
function updateQRInstructions(state) {
  const instructions = document.querySelector('.qr-instructions');

  const messages = {
    loading:
      '<h3>⏳ Generating QR Code...</h3><p>Please wait a moment while we prepare your authentication code.</p>',
    waiting:
      '<h3>⏳ Waiting...</h3><p>The QR code will appear shortly. Make sure WhatsApp is open on your phone.</p>',
    active:
      '<h3>📱 Scan to Connect:</h3><ol><li>Open WhatsApp on your phone</li><li>Tap <strong>Menu</strong> or <strong>Settings</strong></li><li>Tap <strong>Linked Devices</strong></li><li>Tap <strong>Link a Device</strong></li><li>Scan this QR code with your phone</li></ol>',
    expired:
      '<h3>⏰ QR Code Expired</h3><p>QR codes expire after 60 seconds for security. Click the button above to generate a new one.</p>',
    error: "<h3>❌ Error</h3><p>Something went wrong. We'll automatically retry in a moment.</p>",
    authenticating:
      '<h3>🔐 Authenticating...</h3><p>Great! We detected your scan. Connecting to WhatsApp servers...</p>',
    success:
      '<h3>✅ Connected!</h3><p>Your WhatsApp bot is now active and ready to process messages.</p>'
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
  const loggingSection = document.getElementById('loggingSection');
  if (loggingSection) {
    loggingSection.classList.add('celebrate');

    setTimeout(() => {
      loggingSection.classList.remove('celebrate');
    }, 2000);
  }
}

// Update status display
function updateStatus(data) {
  // Uptime - update in logging section
  if (data.uptime?.readable) {
    const uptimeEl = document.getElementById('uptimeLogs');
    if (uptimeEl) {
      uptimeEl.textContent = data.uptime.readable;
    }
  }

  // Update total message count from humanBehavior
  if (data.humanBehavior) {
    const hb = data.humanBehavior;
    const daily = hb.messageCount?.daily || 0;
    totalMessageCount = daily;
    const totalMsgEl = document.getElementById('totalMessages');
    if (totalMsgEl) {
      totalMsgEl.textContent = totalMessageCount;
    }
  }
}

// Update workflows display
function updateWorkflows(workflows) {
  const container = document.getElementById('workflowsContainer');

  if (!workflows || workflows.length === 0) {
    container.innerHTML = '<p class="empty-state">No active workflows</p>';
    return;
  }

  container.innerHTML = workflows
    .map(
      wf => `
    <div class="workflow-item ${wf.status}">
      <div class="workflow-name">${wf.name}</div>
      <div class="workflow-status">
        Status: ${wf.status} | Started: ${new Date(wf.startedAt).toLocaleString()}
      </div>
    </div>
  `
    )
    .join('');
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
      // Clear authentication state from localStorage
      localStorage.removeItem('whatsapp_authenticated');
      console.log('Authentication state cleared from localStorage');

      showMessage('Session cleared. Please restart the bot.', 'success');

      // Show QR section again after logout
      setTimeout(() => {
        const qrSection = document.getElementById('qrSection');
        const loggingSection = document.getElementById('loggingSection');

        if (qrSection) qrSection.style.display = 'block';
        if (loggingSection) loggingSection.style.display = 'none';
      }, 1000);
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

// Logout - Comprehensive session cleanup
async function logout() {
  if (
    !confirm(
      '🚪 Logout from WhatsApp?\n\nThis will:\n✓ Disconnect your WhatsApp session\n✓ Clear all session data\n✓ Remove authentication\n✓ Prepare for new login\n\nYou will need to scan QR code again to reconnect.'
    )
  ) {
    return;
  }

  const logoutBtn = document.getElementById('logoutBtn');
  const originalText = logoutBtn ? logoutBtn.innerHTML : '';

  try {
    // Disable logout button and show loading state
    if (logoutBtn) {
      logoutBtn.disabled = true;
      logoutBtn.innerHTML = '⏳ Logging out...';
    }

    showMessage('🔄 Logging out and cleaning up session...', 'info');

    const response = await fetch('/logout', { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      showMessage(`✅ Logout successful! ${data.summary}`, 'success');

      // Handle logout UI changes
      handleLogoutEvent();

      // Reload page after short delay to show fresh QR code
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      showMessage('❌ Logout failed: ' + (data.error || 'Unknown error'), 'error');

      // Re-enable button on failure
      if (logoutBtn) {
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = originalText;
      }
    }
  } catch (error) {
    showMessage('❌ Error during logout: ' + error.message, 'error');

    // Re-enable button on error
    if (logoutBtn) {
      logoutBtn.disabled = false;
      logoutBtn.innerHTML = originalText;
    }
  }
}

// Handle logout event from WebSocket or API
function handleLogoutEvent() {
  console.log('Handling logout event - resetting UI');

  // Clear authentication state and QR tracking
  localStorage.removeItem('whatsapp_authenticated');
  currentQRGeneratedAt = null;

  // Hide logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.style.display = 'none';
    logoutBtn.disabled = false;
    logoutBtn.innerHTML = '🚪 Logout';
  }

  // Show QR section
  const qrSection = document.getElementById('qrSection');
  if (qrSection) {
    qrSection.style.display = 'block';
  }

  // Hide logging section
  const loggingSection = document.getElementById('loggingSection');
  if (loggingSection) {
    loggingSection.style.display = 'none';
  }

  // Clear logs
  const logContainer = document.getElementById('logContainer');
  if (logContainer) {
    logContainer.innerHTML = `
      <div class="log-entry" style="color: var(--text-secondary); padding: 0.5rem;">
        <span class="log-time">[Waiting for logs...]</span>
        <span class="log-message">Bot activity will appear here</span>
      </div>
    `;
  }

  // Reset message count
  totalMessageCount = 0;
  const totalMessagesEl = document.getElementById('totalMessages');
  if (totalMessagesEl) {
    totalMessagesEl.textContent = '0';
  }

  // Show QR waiting state
  showQRWaiting();
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
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.style.background = '#10b981';

        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
      })
      .catch(err => {
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

// Add log entry to the logging display
const MAX_LOG_ENTRIES = 200; // Keep last 200 log entries
function addLogEntry(logData) {
  const container = document.getElementById('logContainer');
  if (!container) return;

  // Clear initial placeholder message if present
  if (container.querySelector('.log-entry .log-time')?.textContent === '[Waiting for logs...]') {
    container.innerHTML = '';
  }

  // Create log entry element
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  logEntry.style.cssText =
    'padding: 0.5rem; border-bottom: 1px solid var(--border-color); display: flex; gap: 1rem;';

  // Format timestamp
  const time = new Date(logData.timestamp).toLocaleTimeString();

  // Get level color
  const levelColors = {
    debug: '#6b7280',
    info: '#3b82f6',
    warn: '#f59e0b',
    error: '#ef4444',
    log: '#10b981'
  };
  const levelColor = levelColors[logData.level] || '#6b7280';

  logEntry.innerHTML = `
    <span class="log-time" style="color: var(--text-secondary); min-width: 80px;">[${time}]</span>
    <span class="log-level" style="color: ${levelColor}; font-weight: 600; min-width: 60px; text-transform: uppercase;">${logData.level}</span>
    <span class="log-message" style="color: var(--text-primary); flex: 1;">${logData.message}</span>
  `;

  // Add to container
  container.appendChild(logEntry);

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;

  // Remove old entries if exceeding max
  while (container.children.length > MAX_LOG_ENTRIES) {
    container.removeChild(container.firstChild);
  }
}

// Clear logs
function clearLogs() {
  const container = document.getElementById('logContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="log-entry" style="color: var(--text-secondary); padding: 0.5rem;">
      <span class="log-time">[Logs cleared]</span>
      <span class="log-message">Waiting for new activity...</span>
    </div>
  `;
}
