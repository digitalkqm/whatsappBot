/**
 * Toast Notification System
 * Modern, accessible toast notifications with auto-dismiss
 */

class ToastManager {
  constructor() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      this.container.setAttribute('role', 'alert');
      this.container.setAttribute('aria-live', 'assertive');
      this.container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(this.container);
    }
    this.toasts = new Map();
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {Object} options - Configuration options
   * @param {string} options.title - Toast title
   * @param {string} options.type - Toast type: success, error, warning, info
   * @param {number} options.duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
   * @param {string} options.icon - Custom icon emoji
   */
  show(message, options = {}) {
    const {
      title = '',
      type = 'info',
      duration = 5000,
      icon = this.getDefaultIcon(type)
    } = options;

    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = id;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${icon}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : ''}
        <div class="toast-message">${this.escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Close notification">×</button>
    `;

    const closeButton = toast.querySelector('.toast-close');
    closeButton.addEventListener('click', () => this.dismiss(id));

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    // Trigger reflow for animation
    toast.offsetHeight;

    return id;
  }

  /**
   * Dismiss a toast by ID
   * @param {string} id - Toast ID to dismiss
   */
  dismiss(id) {
    const toast = this.toasts.get(id);
    if (!toast) return;

    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.toasts.delete(id);
    }, 300);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    this.toasts.forEach((_, id) => this.dismiss(id));
  }

  /**
   * Show success toast
   */
  success(message, title = 'Success') {
    return this.show(message, { type: 'success', title });
  }

  /**
   * Show error toast
   */
  error(message, title = 'Error') {
    return this.show(message, { type: 'error', title, duration: 7000 });
  }

  /**
   * Show warning toast
   */
  warning(message, title = 'Warning') {
    return this.show(message, { type: 'warning', title, duration: 6000 });
  }

  /**
   * Show info toast
   */
  info(message, title = '') {
    return this.show(message, { type: 'info', title });
  }

  /**
   * Get default icon for toast type
   */
  getDefaultIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create global toast instance
window.toast = new ToastManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToastManager;
}
