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
        id: `${priority}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.queue.push(queueItem);

      // Sort by priority (critical first, low last)
      this.sortQueue();

      console.log(`📥 Message queued [${priority}] - Queue size: ${this.queue.length} - ID: ${queueItem.id}`);

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
      const item = this.queue.shift();

      try {
        console.log(`📨 Sending message [${item.priority}] to ${item.recipient.substring(0, 15)}... - ID: ${item.id}`);

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

        console.log(`✅ Message sent [${item.priority}] - ID: ${item.id}`);

        // Resolve promise
        item.resolve(result);

      } catch (error) {
        // Update stats
        this.stats.totalFailed++;
        this.stats.byPriority[item.priority].failed++;

        console.error(`❌ Failed to send message [${item.priority}] - ID: ${item.id}:`, error.message);

        // Reject promise
        item.reject(error);
      }

      // Small delay between sends to avoid rate limiting by WhatsApp
      // Critical messages have shorter delay
      const delay = item.priority === 'critical' ? 300 :
                   item.priority === 'high' ? 500 :
                   item.priority === 'normal' ? 700 : 1000;

      if (this.queue.length > 0) {
        await this.sleep(delay);
      }
    }

    this.isProcessing = false;
    console.log('✅ Queue processing complete');
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
      successRate: this.stats.totalSent > 0
        ? ((this.stats.totalSent / (this.stats.totalSent + this.stats.totalFailed)) * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

module.exports = MessageSendQueue;
