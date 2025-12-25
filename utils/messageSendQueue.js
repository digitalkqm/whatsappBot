/**
 * Message Send Queue
 *
 * Centralized queue for all outbound WhatsApp messages with priority system.
 * Prevents concurrent send collisions and ensures critical workflows (valuations)
 * take priority over bulk operations (broadcasts).
 *
 * Priority Levels:
 * - critical: Valuation replies, urgent customer-facing messages
 * - high: Important notifications, confirmations
 * - normal: Regular automated responses
 * - low: Broadcast messages, bulk operations
 */

class MessageSendQueue {
  constructor(client) {
    this.client = client;
    this.queue = [];
    this.isProcessing = false;
    this.consecutiveFrameErrors = 0;
    this.maxConsecutiveFrameErrors = 3;
    this.isRecovering = false;
    this.stats = {
      totalSent: 0,
      totalFailed: 0,
      byPriority: {
        critical: { sent: 0, failed: 0 },
        high: { sent: 0, failed: 0 },
        normal: { sent: 0, failed: 0 },
        low: { sent: 0, failed: 0 }
      }
    };

    console.log('📬 MessageSendQueue initialized');
  }

  /**
   * Update client reference (for recovery after detached frame)
   */
  setClient(client) {
    this.client = client;
    this.consecutiveFrameErrors = 0;
    console.log('🔄 MessageSendQueue client reference updated');
  }

  /**
   * Keep the frame alive by performing a lightweight operation
   * This prevents Chrome from garbage collecting the frame during long idle periods
   */
  async keepAlive() {
    try {
      if (this.client && this.client.pupPage) {
        // Perform a lightweight operation to keep the frame active
        await this.client.pupPage.evaluate(() => {
          return document.readyState;
        });
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`⚠️ Keep-alive ping failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if the frame is healthy before sending
   */
  async checkFrameHealth() {
    try {
      if (!this.client || !this.client.pupPage) {
        return false;
      }
      // Try to get page state - this will throw if frame is detached
      const state = await this.client.getState();
      return state === 'CONNECTED';
    } catch (error) {
      console.warn(`⚠️ Frame health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Sleep with keep-alive pings for long delays
   * Pings every 30 seconds to prevent frame staleness
   */
  async sleepWithKeepAlive(ms) {
    const PING_INTERVAL = 30000; // Ping every 30 seconds
    let elapsed = 0;

    while (elapsed < ms) {
      const sleepTime = Math.min(PING_INTERVAL, ms - elapsed);
      await this.sleep(sleepTime);
      elapsed += sleepTime;

      // Keep-alive ping if we still have more time to wait
      if (elapsed < ms) {
        await this.keepAlive();
      }
    }
  }

  /**
   * Add message to queue
   * @param {string} recipient - WhatsApp ID or group ID
   * @param {string|object} message - Message text or MessageMedia object
   * @param {string} priority - 'critical', 'high', 'normal', or 'low'
   * @param {object} options - Additional options (caption, media, etc.)
   * @returns {Promise} Resolves when message is sent
   */
  async send(recipient, message, priority = 'normal', options = {}) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        recipient,
        message,
        priority,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        id: `${priority}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.queue.push(queueItem);

      // Sort by priority (critical first, low last)
      this.sortQueue();

      console.log(
        `📥 Message queued [${priority}] - Queue size: ${this.queue.length} - ID: ${queueItem.id}`
      );

      // Start processing if not already running
      this.processQueue();
    });
  }

  /**
   * Sort queue by priority
   */
  sortQueue() {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };

    this.queue.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // If same priority, maintain FIFO (first in, first out)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Process queue sequentially
   */
  async processQueue() {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    // No messages to process
    if (this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`📤 Processing queue - ${this.queue.length} messages waiting`);

    while (this.queue.length > 0) {
      // Check if we need to attempt page recovery
      if (this.consecutiveFrameErrors >= this.maxConsecutiveFrameErrors && !this.isRecovering) {
        console.warn(`🔧 ${this.consecutiveFrameErrors} consecutive frame errors - attempting page recovery...`);
        await this.attemptPageRecovery();
      }

      const item = this.queue.shift();

      // Proactive frame health check before sending (for first message or after long delays)
      if (item.retryCount === 0) {
        const isHealthy = await this.checkFrameHealth();
        if (!isHealthy) {
          console.warn('⚠️ Frame unhealthy before send - attempting proactive recovery...');
          await this.attemptPageRecovery();
        }
      }

      try {
        console.log(
          `📨 Sending message [${item.priority}] to ${item.recipient.substring(0, 15)}... - ID: ${item.id}${item.retryCount > 0 ? ` (retry ${item.retryCount}/${item.maxRetries})` : ''}`
        );

        // Send message via WhatsApp client
        let result;

        if (item.options.media) {
          // Send with media
          result = await this.client.sendMessage(item.recipient, item.options.media, {
            caption: item.message
          });
        } else {
          // Send text message
          result = await this.client.sendMessage(item.recipient, item.message);
        }

        // Update stats
        this.stats.totalSent++;
        this.stats.byPriority[item.priority].sent++;
        this.consecutiveFrameErrors = 0; // Reset on success

        console.log(`✅ Message sent [${item.priority}] - ID: ${item.id}`);

        // Resolve promise
        item.resolve(result);
      } catch (error) {
        // Check if error is retryable
        const isRetryableError = this.isRetryableError(error);
        const isFrameError = this.isFrameError(error);
        const canRetry = item.retryCount < item.maxRetries;

        // Track consecutive frame errors
        if (isFrameError) {
          this.consecutiveFrameErrors++;
        }

        if (isRetryableError && canRetry) {
          // Retry the message
          item.retryCount++;
          const retryDelay = 2000 * item.retryCount; // Exponential backoff: 2s, 4s, 6s

          console.warn(
            `⚠️ Retryable error for message [${item.priority}] - ID: ${item.id}: ${error.message}`
          );
          console.log(
            `🔄 Will retry in ${retryDelay}ms (attempt ${item.retryCount}/${item.maxRetries})`
          );

          // If too many frame errors, attempt recovery before retry
          if (isFrameError && this.consecutiveFrameErrors >= this.maxConsecutiveFrameErrors) {
            console.warn('🔧 Too many frame errors - attempting page recovery before retry...');
            await this.attemptPageRecovery();
          }

          // Wait before retry
          await this.sleep(retryDelay);

          // Re-add to front of queue (maintain priority)
          this.queue.unshift(item);
          this.sortQueue();

          continue; // Skip to next iteration
        }

        // Non-retryable error or max retries exceeded
        this.stats.totalFailed++;
        this.stats.byPriority[item.priority].failed++;

        if (item.retryCount >= item.maxRetries) {
          console.error(
            `❌ Max retries exceeded for message [${item.priority}] - ID: ${item.id}: ${error.message}`
          );
        } else {
          console.error(
            `❌ Failed to send message [${item.priority}] - ID: ${item.id}: ${error.message}`
          );
        }

        // Reject promise
        item.reject(error);
      }

      // Small delay between sends to avoid rate limiting by WhatsApp
      // Critical messages have shorter delay
      const delay =
        item.priority === 'critical'
          ? 300
          : item.priority === 'high'
            ? 500
            : item.priority === 'normal'
              ? 700
              : 1000;

      if (this.queue.length > 0) {
        await this.sleep(delay);
      }
    }

    this.isProcessing = false;
    console.log('✅ Queue processing complete');
  }

  /**
   * Check if error is retryable
   * @param {Error} error - The error object
   * @returns {boolean} True if error should trigger retry
   */
  isRetryableError(error) {
    const errorMessage = error.message || '';

    // Retryable error patterns
    const retryablePatterns = [
      'detached Frame', // Puppeteer frame detached
      'Execution context was destroyed', // Page reloaded
      'Session closed', // Browser session issue
      'Target closed', // Browser target closed
      'Protocol error', // Connection issue
      'Navigation failed', // Page navigation issue
      'net::ERR_', // Network errors
      'timeout', // Timeout errors
      'ECONNRESET', // Connection reset
      'ETIMEDOUT', // Timeout
      'ENOTFOUND' // DNS/network issue
    ];

    // Check if error matches any retryable pattern
    return retryablePatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if error is specifically a frame error
   * @param {Error} error - The error object
   * @returns {boolean} True if error is frame-related
   */
  isFrameError(error) {
    const errorMessage = error.message || '';
    const framePatterns = [
      'detached Frame',
      'Execution context was destroyed',
      'Target closed',
      'Session closed'
    ];
    return framePatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Attempt to recover from frame errors by refreshing the page
   */
  async attemptPageRecovery() {
    if (this.isRecovering) {
      console.log('⏳ Recovery already in progress...');
      return;
    }

    this.isRecovering = true;
    console.log('🔧 Attempting page recovery...');

    try {
      // Try to get the puppeteer page and refresh it
      if (this.client && this.client.pupPage) {
        console.log('🔄 Refreshing WhatsApp Web page...');

        // Wait a moment before refresh
        await this.sleep(2000);

        // Reload the page
        await this.client.pupPage.reload({ waitUntil: 'networkidle0', timeout: 60000 });

        // Wait for WhatsApp to fully load after refresh
        await this.sleep(5000);

        console.log('✅ Page refresh completed');
        this.consecutiveFrameErrors = 0;
      } else {
        console.warn('⚠️ Cannot refresh - client or page not available');
      }
    } catch (error) {
      console.error(`❌ Page recovery failed: ${error.message}`);
      // Don't reset consecutiveFrameErrors - let it fail and caller can handle
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    const queueByPriority = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0
    };

    this.queue.forEach(item => {
      queueByPriority[item.priority]++;
    });

    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      queueByPriority,
      stats: this.stats
    };
  }

  /**
   * Get queue length by priority
   */
  getQueueLength(priority = null) {
    if (priority) {
      return this.queue.filter(item => item.priority === priority).length;
    }
    return this.queue.length;
  }

  /**
   * Clear queue (emergency use only)
   */
  clearQueue(priority = null) {
    if (priority) {
      const beforeLength = this.queue.length;
      this.queue = this.queue.filter(item => item.priority !== priority);
      const cleared = beforeLength - this.queue.length;
      console.log(`🗑️ Cleared ${cleared} messages with priority: ${priority}`);
      return cleared;
    } else {
      const cleared = this.queue.length;
      this.queue = [];
      console.log(`🗑️ Cleared entire queue: ${cleared} messages`);
      return cleared;
    }
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.isProcessing = true;
    console.log('⏸️ Queue processing paused');
  }

  /**
   * Resume queue processing
   */
  resume() {
    this.isProcessing = false;
    console.log('▶️ Queue processing resumed');
    this.processQueue();
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate:
        this.stats.totalSent > 0
          ? (
              (this.stats.totalSent / (this.stats.totalSent + this.stats.totalFailed)) *
              100
            ).toFixed(2) + '%'
          : '0%'
    };
  }
}

module.exports = MessageSendQueue;
