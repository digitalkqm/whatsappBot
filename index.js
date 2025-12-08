const fs = require('fs');
const path = require('path');
const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const WorkflowEngine = require('./workflows/engine');
const { valuationRequestWorkflow } = require('./workflows/valuationRequestSupabase');
const { valuationReplyWorkflow } = require('./workflows/valuationReplySupabase');
const ratePackageUpdateWorkflow = require('./workflows/ratePackageUpdate');
const bankRatesUpdateWorkflow = require('./workflows/bankRatesUpdate');
const WorkflowAPI = require('./api/workflowAPI');
const TemplateAPI = require('./api/templateAPI');
const ContactAPI = require('./api/contactAPI');
const BroadcastContactAPI = require('./api/broadcastContactAPI');
const ValuationAPI = require('./api/valuationAPI');
const BankerAPI = require('./api/bankerAPI');
const ImageUploadAPI = require('./api/imageUploadAPI');
const MessageSendQueue = require('./utils/messageSendQueue');
const multer = require('multer');

// Puppeteer stealth configuration to avoid WhatsApp detection
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- Config ---
const PORT = process.env.PORT || 3000;
const SESSION_ID = process.env.WHATSAPP_SESSION_ID || 'default_session';
const BOT_VERSION = '1.0.1';
const startedAt = Date.now();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// --- Human-like Behavior Configuration ---
const HUMAN_CONFIG = {
  // Random delays (in milliseconds)
  MIN_READ_DELAY: 2000,        // Minimum time before "reading" a message
  MAX_READ_DELAY: 15000,       // Maximum time before "reading" a message
  MIN_RESPONSE_DELAY: 1000,    // Minimum time before processing/responding
  MAX_RESPONSE_DELAY: 10000,   // Maximum time before processing/responding
  MIN_TYPING_DURATION: 1000,   // Minimum typing indicator duration
  MAX_TYPING_DURATION: 5000,   // Maximum typing indicator duration

  // Rate limiting
  MAX_MESSAGES_PER_HOUR: 80,   // Maximum messages to process per hour
  MAX_MESSAGES_PER_DAY: 500,   // Maximum messages to process per day
  COOLDOWN_BETWEEN_ACTIONS: 250, // Minimum time between any actions

  // Activity patterns (24-hour format)
  ACTIVE_HOURS_START: 7,       // Start being active at 7 AM (randomized daily)
  ACTIVE_HOURS_END: 23,        // Stop being active at 11 PM (randomized daily)
  ACTIVE_HOURS_VARIATION: 1,   // ±1 hour random variation daily
  SLEEP_MODE_DELAY_MULTIPLIER: 5, // Multiply delays during sleep hours

  // Message patterns
  IGNORE_PROBABILITY: 0,       // Message ignoring disabled per user request
  DOUBLE_CHECK_PROBABILITY: 0.1, // 10% chance to re-read a message
  // Weekend/weekday patterns
  WEEKEND_DELAY_MULTIPLIER: 1.5, // 50% slower on weekends

  // Network variability simulation
  NETWORK_DELAY_PROBABILITY: 0.03, // 3% chance of network delay
  NETWORK_DELAY_MIN: 2000, // 2 seconds minimum network delay
  NETWORK_DELAY_MAX: 10000, // 10 seconds maximum network delay

  // Response quality variation
  BRIEF_RESPONSE_PROBABILITY: 0.1, // 10% chance of brief response
};

// --- Human Behavior Tracking ---
class HumanBehaviorManager {
  constructor() {
    this.messageCount = { hourly: 0, daily: 0 };
    this.lastAction = 0;
    this.lastHourReset = Date.now();
    this.lastDayReset = Date.now();
    this.processedMessages = new Set(); // Track processed message IDs
    this.messageQueue = []; // Queue for processing messages
    this.isProcessingQueue = false;
    this.client = null; // WhatsApp client reference for notifications

    // Randomized active hours (set daily)
    this.dailyActiveHours = this.getRandomizedActiveHours();
    this.lastActiveHoursUpdate = new Date().getDate();
  }

  // Get randomized active hours for the day
  getRandomizedActiveHours() {
    const variation = (Math.random() * 2 - 1) * HUMAN_CONFIG.ACTIVE_HOURS_VARIATION;
    return {
      start: Math.max(6, Math.floor(HUMAN_CONFIG.ACTIVE_HOURS_START + variation)),
      end: Math.min(24, Math.floor(HUMAN_CONFIG.ACTIVE_HOURS_END + variation))
    };
  }

  // Update daily active hours if needed
  updateDailyActiveHours() {
    const currentDay = new Date().getDate();
    if (currentDay !== this.lastActiveHoursUpdate) {
      this.dailyActiveHours = this.getRandomizedActiveHours();
      this.lastActiveHoursUpdate = currentDay;
      log('debug', `🕐 Daily active hours updated: ${this.dailyActiveHours.start}:00 - ${this.dailyActiveHours.end}:00`);
    }
  }

  // Check if we're in active hours
  isActiveHours() {
    this.updateDailyActiveHours();
    const now = new Date();
    const hour = now.getHours();
    return hour >= this.dailyActiveHours.start && hour < this.dailyActiveHours.end;
  }

  // Get weekend multiplier
  getWeekendMultiplier() {
    const day = new Date().getDay();
    return (day === 0 || day === 6) ? HUMAN_CONFIG.WEEKEND_DELAY_MULTIPLIER : 1.0;
  }

  // Get day progress multiplier (slower as day progresses)
  getDayProgressMultiplier() {
    const hour = new Date().getHours();
    if (hour < 10) return 1.0;  // Morning: normal speed
    if (hour < 14) return 1.2;  // Lunch: slower
    if (hour < 18) return 1.0;  // Afternoon: normal
    return 1.5;                 // Evening: slower (tired)
  }

  // Simulate network variability
  async simulateNetworkVariability() {
    if (Math.random() < HUMAN_CONFIG.NETWORK_DELAY_PROBABILITY) {
      const delay = HUMAN_CONFIG.NETWORK_DELAY_MIN +
                    Math.random() * (HUMAN_CONFIG.NETWORK_DELAY_MAX - HUMAN_CONFIG.NETWORK_DELAY_MIN);
      await this.sleep(delay);
      log('debug', `🌐 Simulated network delay: ${Math.round(delay)}ms`);
    }
  }

  // Check if we can process more messages (rate limiting)
  canProcessMessage(groupId = null) {
    this.resetCountersIfNeeded();

    if (this.messageCount.hourly >= HUMAN_CONFIG.MAX_MESSAGES_PER_HOUR) {
      log('warn', '⏱️ Hourly message limit reached, skipping message');
      return { allowed: false, reason: 'hourly_limit', groupId };
    }

    if (this.messageCount.daily >= HUMAN_CONFIG.MAX_MESSAGES_PER_DAY) {
      log('warn', '📅 Daily message limit reached, skipping message');
      return { allowed: false, reason: 'daily_limit', groupId };
    }

    // Check cooldown between actions
    const timeSinceLastAction = Date.now() - this.lastAction;
    if (timeSinceLastAction < HUMAN_CONFIG.COOLDOWN_BETWEEN_ACTIONS) {
      return { allowed: false, reason: 'cooldown', groupId };
    }

    return { allowed: true };
  }

  // Reset counters when needed
  resetCountersIfNeeded() {
    const now = Date.now();
    
    // Reset hourly counter
    if (now - this.lastHourReset > 60 * 60 * 1000) {
      this.messageCount.hourly = 0;
      this.lastHourReset = now;
      log('debug', '🔄 Hourly message counter reset');
    }

    // Reset daily counter
    if (now - this.lastDayReset > 24 * 60 * 60 * 1000) {
      this.messageCount.daily = 0;
      this.lastDayReset = now;
      log('debug', '🔄 Daily message counter reset');
    }
  }

  // Record message processing
  recordMessageProcessed(messageId, groupId = null) {
    this.messageCount.hourly++;
    this.messageCount.daily++;
    this.lastAction = Date.now();
    this.processedMessages.add(messageId);

    // Clean old processed messages (keep only last 1000)
    if (this.processedMessages.size > 1000) {
      const messagesToRemove = Array.from(this.processedMessages).slice(0, 100);
      messagesToRemove.forEach(id => this.processedMessages.delete(id));
    }
  }

  // Check if message was already processed
  wasMessageProcessed(messageId) {
    return this.processedMessages.has(messageId);
  }

  // Send rate limit notification to group
  async sendRateLimitNotification(groupId, reason) {
    if (!this.client || !groupId) {
      log('warn', '⚠️ Cannot send rate limit notification: client or groupId missing');
      return;
    }

    try {
      let message = '';
      if (reason === 'hourly_limit') {
        message = '⏱️ *Rate Limit Reached*\n\nThe bot has reached its hourly message limit (80 messages/hour).\n\nPlease wait for the next hour to continue processing valuation requests.';
      } else if (reason === 'daily_limit') {
        message = '📅 *Daily Rate Limit Reached*\n\nThe bot has reached its daily message limit (500 messages/day).\n\nProcessing will resume tomorrow. Thank you for your patience!';
      } else {
        return; // Don't send notification for cooldown
      }

      await this.client.sendMessage(groupId, message);
      log('info', `📨 Rate limit notification sent to group ${groupId} (reason: ${reason})`);
    } catch (err) {
      log('error', `Failed to send rate limit notification: ${err.message}`);
    }
  }

  // Generate human-like delay
  getRandomDelay(min, max) {
    const baseDelay = Math.random() * (max - min) + min;

    // Apply sleep mode multiplier if outside active hours
    if (!this.isActiveHours()) {
      return baseDelay * HUMAN_CONFIG.SLEEP_MODE_DELAY_MULTIPLIER;
    }

    // Apply weekend multiplier
    const weekendMultiplier = this.getWeekendMultiplier();

    // Apply day progress multiplier
    const dayProgressMultiplier = this.getDayProgressMultiplier();

    // Combine all multipliers
    return baseDelay * weekendMultiplier * dayProgressMultiplier;
  }

  // Add message to processing queue
  addToQueue(messageData) {
    this.messageQueue.push({
      ...messageData,
      addedAt: Date.now(),
      processAt: Date.now() + this.getRandomDelay(HUMAN_CONFIG.MIN_READ_DELAY, HUMAN_CONFIG.MAX_READ_DELAY)
    });

    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  // Process message queue with human-like timing
  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const now = Date.now();
      const nextMessage = this.messageQueue.find(msg => msg.processAt <= now);

      if (!nextMessage) {
        // Wait for the next message to be ready
        const nextProcessTime = Math.min(...this.messageQueue.map(msg => msg.processAt));
        const waitTime = Math.min(nextProcessTime - now, 5000); // Wait max 5 seconds
        await this.sleep(waitTime);
        continue;
      }

      // Remove message from queue
      const messageIndex = this.messageQueue.indexOf(nextMessage);
      this.messageQueue.splice(messageIndex, 1);

      // Process the message
      try {
        await this.processMessageWithHumanBehavior(nextMessage);
      } catch (err) {
        log('error', `Error processing queued message: ${err.message}`);
      }

      // Random delay between processing messages
      const delay = this.getRandomDelay(1000, 5000);
      await this.sleep(delay);
    }

    this.isProcessingQueue = false;
  }

  // Process message with human-like behavior
  async processMessageWithHumanBehavior(messageData) {
    const { msg, payload } = messageData;

    // Random chance to ignore message (simulate human oversight) - DISABLED per user request
    if (Math.random() < HUMAN_CONFIG.IGNORE_PROBABILITY) {
      log('info', '🤷 Randomly ignoring message (simulating human oversight)');
      return;
    }

    // Simulate network variability
    await this.simulateNetworkVariability();

    // Check rate limits
    const rateLimitCheck = this.canProcessMessage(payload.groupId);
    if (!rateLimitCheck.allowed) {
      log('info', `⏱️ Rate limit reached (${rateLimitCheck.reason}), skipping message processing`);

      // Send notification for valuation request workflows when rate limited
      if (rateLimitCheck.reason === 'hourly_limit' || rateLimitCheck.reason === 'daily_limit') {
        await this.sendRateLimitNotification(rateLimitCheck.groupId, rateLimitCheck.reason);
      }
      return;
    }

    // Simulate reading the message
    await this.simulateReadingMessage(msg);

    // Random chance to double-check message
    if (Math.random() < HUMAN_CONFIG.DOUBLE_CHECK_PROBABILITY) {
      log('info', '🔍 Double-checking message (simulating human behavior)');
      await this.sleep(this.getRandomDelay(1000, 3000));
    }

    // Add response delay
    const responseDelay = this.getRandomDelay(
      HUMAN_CONFIG.MIN_RESPONSE_DELAY,
      HUMAN_CONFIG.MAX_RESPONSE_DELAY
    );
    await this.sleep(responseDelay);

    // Process the message
    await this.sendWebhooks(payload);
    this.recordMessageProcessed(payload.messageId, payload.groupId);
  }

  // Simulate reading a message (mark as read after delay)
  async simulateReadingMessage(msg) {
    try {
      // Random delay before marking as read
      const readDelay = this.getRandomDelay(HUMAN_CONFIG.MIN_READ_DELAY, HUMAN_CONFIG.MAX_READ_DELAY);
      await this.sleep(readDelay);
      
      // Mark message as read (if supported)
      if (msg && typeof msg.markAsRead === 'function') {
        await msg.markAsRead();
        log('debug', '👁️ Message marked as read');
      }
    } catch (err) {
      log('warn', `Failed to mark message as read: ${err.message}`);
    }
  }

  // Process workflows
  async sendWebhooks(payload) {
    try {
      const groupInfo = payload.groupId ? ` [Group: ${payload.groupId}]` : '';

      if (payload.messageType === 'valuation_request') {
        log('info', `📊 Executing valuation request workflow (Supabase)${groupInfo}`);
        await valuationRequestWorkflow(payload, workflowEngine);
      }

      if (payload.messageType === 'valuation_reply') {
        log('info', `📨 Executing valuation reply workflow (Supabase)${groupInfo}`);
        await valuationReplyWorkflow(payload, workflowEngine);
      }

      if (payload.messageType === 'rate_package_update') {
        log('info', `📦 Executing rate package update workflow (n8n webhook)${groupInfo}`);
        await workflowEngine.executeWorkflow('rate_package_update', payload);
      }

      if (payload.messageType === 'valuation') {
        log('info', `📊 Executing old valuation workflow${groupInfo}`);
        await workflowEngine.executeWorkflow('valuation', payload);
      }

      if (payload.messageType === 'interest_rate' || payload.messageType === 'bank_rates_update') {
        log('info', `🏦 Executing bank rates update workflow (n8n webhook)${groupInfo}`);
        await workflowEngine.executeWorkflow('bank_rates_update', payload);
      }
    } catch (error) {
      log('error', `Workflow execution failed: ${error.message}${payload.groupId ? ` [Group: ${payload.groupId}]` : ''}`);
      throw error;
    }
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get status for health endpoint
  getStatus() {
    return {
      messageCount: this.messageCount,
      queueLength: this.messageQueue.length,
      isProcessingQueue: this.isProcessingQueue,
      isActiveHours: this.isActiveHours(),
      lastAction: new Date(this.lastAction).toISOString(),
    };
  }
}

// Initialize human behavior manager
const humanBehavior = new HumanBehaviorManager();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials. Exiting.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize Workflow Engine
const workflowEngine = new WorkflowEngine(SUPABASE_URL, SUPABASE_ANON_KEY);
workflowEngine.registerWorkflow('rate_package_update', ratePackageUpdateWorkflow); // n8n webhook for rate packages
workflowEngine.registerWorkflow('bank_rates_update', bankRatesUpdateWorkflow); // n8n webhook for bank rates
workflowEngine.registerWorkflow('valuation_request', valuationRequestWorkflow); // Supabase workflow
workflowEngine.registerWorkflow('valuation_reply', valuationReplyWorkflow); // Supabase reply workflow

// Initialize API handlers
const workflowAPI = new WorkflowAPI(SUPABASE_URL, SUPABASE_ANON_KEY);
const templateAPI = new TemplateAPI(SUPABASE_URL, SUPABASE_ANON_KEY);
const contactAPI = new ContactAPI(SUPABASE_URL, SUPABASE_ANON_KEY);
const broadcastContactAPI = new BroadcastContactAPI(SUPABASE_URL, SUPABASE_ANON_KEY);
const valuationAPI = new ValuationAPI(SUPABASE_URL, SUPABASE_ANON_KEY);
const bankerAPI = new BankerAPI(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize ImageKit API for image uploads
let imageUploadAPI = null;
if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
  try {
    imageUploadAPI = new ImageUploadAPI(
      process.env.IMAGEKIT_PUBLIC_KEY,
      process.env.IMAGEKIT_PRIVATE_KEY,
      process.env.IMAGEKIT_URL_ENDPOINT
    );
    console.log('✅ ImageKit initialized successfully');
  } catch (error) {
    console.error('⚠️  ImageKit initialization failed:', error.message);
  }
} else {
  console.log('⚠️  ImageKit not configured - image upload feature will be unavailable');
}

// Configure Multer for memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const log = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] [${level.toUpperCase()}] [${SESSION_ID}] ${message}`;
  console[level](formatted, ...args);

  // Broadcast logs to WebSocket clients for dashboard display
  try {
    broadcastToClients({
      type: 'log',
      level: level,
      message: message,
      timestamp: timestamp,
      session: SESSION_ID
    });
  } catch (err) {
    // Silent fail to avoid recursive logging
  }
};

// Global QR code storage for dashboard
let currentQRCode = null;

// --- Enhanced Session Data Extraction ---
async function extractSessionData(client) {
  if (!client || !client.pupPage) {
    log('warn', '⚠️ Cannot extract session data: No puppeteer page available');
    return null;
  }
  
  try {
    // Check if page is still usable
    try {
      const isPageAlive = await client.pupPage.evaluate(() => true).catch(() => false);
      if (!isPageAlive) {
        log('warn', '⚠️ Puppeteer page is no longer responsive, cannot extract data');
        return null;
      }
    } catch (pageErr) {
      log('warn', `⚠️ Error checking page status: ${pageErr.message}`);
      return null;
    }
    
    // Enhanced localStorage extraction 
    const rawLocalStorage = await client.pupPage.evaluate(() => {
      try {
        // First, verify WAWebJS has properly loaded
        if (typeof window.Store === 'undefined' || !window.Store) {
          console.error("WhatsApp Web Store not initialized");
          return { error: "Store not initialized" };
        }
        
        // Extract ALL localStorage data comprehensively
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          data[key] = localStorage.getItem(key);
        }
        
        // Add additional WAWebJS-specific session data if available
        if (window.Store && window.Store.AppState) {
          data['WAWebJS_AppState'] = JSON.stringify(window.Store.AppState.serialize());
        }
        
        // Add session metadata
        data['_session_metadata'] = JSON.stringify({
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
        
        return data;
      } catch (e) {
        console.error("Error extracting localStorage:", e);
        return { error: e.toString() };
      }
    }).catch(err => {
      log('warn', `⚠️ Error during page evaluation: ${err.message}`);
      return { error: err.message };
    });
    
    if (rawLocalStorage && rawLocalStorage.error) {
      log('warn', `⚠️ Error in page extraction: ${rawLocalStorage.error}`);
      return null;
    }
    
    if (rawLocalStorage && Object.keys(rawLocalStorage).length > 5) {
      log('info', `🔍 Extracted raw localStorage with ${Object.keys(rawLocalStorage).length} items`);

      // Log a few keys for debugging (first 5 keys)
      const sampleKeys = Object.keys(rawLocalStorage).slice(0, 5);
      log('debug', `Sample keys: ${sampleKeys.join(', ')}`);

      // Validate session size and content
      const sessionSize = JSON.stringify(rawLocalStorage).length;

      // More flexible validation - check for any WhatsApp-related keys
      const hasWAData = Object.keys(rawLocalStorage).some(key =>
        key.toLowerCase().includes('wa') ||
        key.includes('WABrowserId') ||
        key.includes('WASecretBundle') ||
        key.includes('WAToken') ||
        key.includes('noise') ||
        key.includes('session')
      );

      if (sessionSize < 1000) {
        log('warn', `Session data too small (${sessionSize} bytes), might be invalid`);
        return null;
      }

      if (!hasWAData) {
        log('warn', 'Session data missing essential WhatsApp keys');
        log('debug', `All keys: ${Object.keys(rawLocalStorage).join(', ')}`);
        return null;
      }

      log('info', `✅ Valid session data extracted (${sessionSize} bytes)`);
      return rawLocalStorage;
    } else {
      log('warn', 'localStorage extraction found too few items');
    }
    
    return null;
  } catch (err) {
    log('error', `Failed to extract session data: ${err.message}`);
    return null;
  }
}

// --- Enhanced Supabase Store for WhatsApp Session ---
class SupabaseStore {
  constructor(supabaseClient, sessionId) {
    this.supabase = supabaseClient;
    this.sessionId = sessionId;
    this.client = null; // Will be set by RemoteAuth
    log('info', `SupabaseStore initialized for session ID: ${this.sessionId}`);
  }

  // Required by RemoteAuth interface
  async sessionExists({ session }) {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_sessions')
        .select('session_key')
        .eq('session_key', session || this.sessionId)
        .limit(1);

      if (error) {
        log('error', `Supabase error in sessionExists: ${error.message}`);
        return false;
      }

      const exists = data && data.length > 0;

      if (exists) {
        log('info', `✅ Session found in Supabase: ${session || this.sessionId} - returning true to restore session`);
      } else {
        log('info', `❌ No session found in Supabase: ${session || this.sessionId} - QR code will be generated`);
      }

      // Return true if session exists - this tells WhatsApp Web.js to restore the session
      // WhatsApp will call extract() to get the session data, avoiding QR code generation
      return exists;
    } catch (err) {
      log('error', `Exception in sessionExists: ${err.message}`);
      return false;
    }
  }

  // Required by RemoteAuth interface
  async extract({ session }) {
    const sessionKey = session || this.sessionId;
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_sessions')
        .select('session_data')
        .eq('session_key', sessionKey)
        .limit(1)
        .single();

      if (error) {
        log('warn', `No existing session found for ${sessionKey}: ${error.message}`);
        return null;
      }
      
      if (!data?.session_data) {
        log('warn', `Session data is empty for ${sessionKey}`);
        return null;
      }

      // Validate session data structure
      let sessionData = data.session_data;
      if (typeof sessionData === 'string') {
        try {
          sessionData = JSON.parse(sessionData);
        } catch (parseErr) {
          log('error', `Failed to parse session data: ${parseErr.message}`);
          return null;
        }
      }

      // Validate essential session keys
      if (typeof sessionData === 'object' && sessionData !== null) {
        const hasEssentialData = Object.keys(sessionData).some(key =>
          key.toLowerCase().includes('wa') ||
          key.includes('WABrowserId') ||
          key.includes('WASecretBundle') ||
          key.includes('WAToken') ||
          key.includes('noise') ||
          key.includes('session')
        );

        if (!hasEssentialData) {
          log('warn', `Session data exists but missing essential WhatsApp keys for ${sessionKey}`);
          return null;
        }
      }
      
      log('info', `✅ Valid session data extracted from Supabase for ${sessionKey}`);
      return sessionData;
    } catch (err) {
      log('error', `Exception in extract: ${err.message}`);
      return null;
    }
  }

  // Required by RemoteAuth interface
  async save({ session, sessionData }) {
    const sessionKey = session || this.sessionId;

    try {
      // Validate sessionData before saving
      if (!sessionData || typeof sessionData !== 'object') {
        log('debug', `⏭️ RemoteAuth automatic backup skipped - incompatible data type (${typeof sessionData})`);
        return; // Gracefully ignore RemoteAuth's ZIP-based backups
      }

      const dataSize = JSON.stringify(sessionData).length;
      log('info', `💾 Saving session data (${dataSize} bytes) for ${sessionKey}`);

      // Ensure we have essential WhatsApp data
      const hasEssentialData = Object.keys(sessionData).some(key =>
        key.toLowerCase().includes('wa') ||
        key.includes('WABrowserId') ||
        key.includes('WASecretBundle') ||
        key.includes('WAToken') ||
        key.includes('noise') ||
        key.includes('session')
      );

      if (!hasEssentialData) {
        log('debug', `⏭️ RemoteAuth automatic backup attempt - missing WhatsApp localStorage keys (likely ZIP extraction)`);

        if (this.client) {
          const freshData = await extractSessionData(this.client);
          if (freshData) {
            sessionData = freshData;
            log('info', '✅ Recovered with fresh localStorage extraction');
          } else {
            log('debug', '⏭️ Cannot recover - skipping this save attempt');
            return; // Skip if we can't get valid data
          }
        } else {
          log('debug', '⏭️ No client available for recovery - skipping save');
          return; // Skip if no client to extract from
        }
      }

      const { error } = await this.supabase
        .from('whatsapp_sessions')
        .upsert({ 
          session_key: sessionKey, 
          session_data: sessionData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'session_key' });

      if (error) {
        log('error', `Failed to save session: ${error.message}`);
      } else {
        log('info', `💾 Session saved to Supabase successfully for ${sessionKey}`);
        
        // Create additional backup
        await this.createBackup(sessionKey, sessionData);
      }
    } catch (err) {
      log('error', `Exception in save: ${err.message}`);
    }
  }

  // Required by RemoteAuth interface
  async delete({ session }) {
    const sessionKey = session || this.sessionId;
    try {
      const { error } = await this.supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_key', sessionKey);

      if (error) {
        log('error', `Failed to delete session: ${error.message}`);
      } else {
        log('info', `🗑️ Session deleted from Supabase for ${sessionKey}`);
      }
    } catch (err) {
      log('error', `Exception in delete: ${err.message}`);
    }
  }

  // Enhanced backup functionality
  async createBackup(sessionKey, sessionData) {
    try {
      const backupKey = `${sessionKey}_backup`;
      
      const { error } = await this.supabase
        .from('whatsapp_sessions')
        .upsert({
          session_key: backupKey,
          session_data: sessionData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'session_key' });

      if (error) {
        log('warn', `Failed to create backup: ${error.message}`);
      } else {
        log('info', `📦 Backup created for ${sessionKey}`);
      }
    } catch (err) {
      log('warn', `Exception creating backup: ${err.message}`);
    }
  }

  // Method to extract and backup local session to Supabase
  async extractLocalSession() {
    try {
      const sessionPath = path.join(__dirname, `.wwebjs_auth/session-${this.sessionId}`);
      
      if (!fs.existsSync(sessionPath)) {
        log('warn', 'No local session directory found');
        return false;
      }

      // Read session files and create backup
      const sessionFiles = this.readSessionFiles(sessionPath);
      if (sessionFiles && Object.keys(sessionFiles).length > 0) {
        await this.save({ sessionData: sessionFiles });
        log('info', '📦 Local session extracted and saved to Supabase');
        return true;
      }
      
      return false;
    } catch (err) {
      log('error', `Failed to extract local session: ${err.message}`);
      return false;
    }
  }

  readSessionFiles(dirPath) {
    try {
      const sessionData = {};
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        
        if (file.isDirectory()) {
          sessionData[file.name] = this.readSessionFiles(filePath);
        } else {
          try {
            sessionData[file.name] = fs.readFileSync(filePath, 'utf8');
          } catch (err) {
            // Skip files that can't be read
            log('warn', `Could not read file ${filePath}: ${err.message}`);
          }
        }
      }
      
      return sessionData;
    } catch (err) {
      log('error', `Error reading session files: ${err.message}`);
      return null;
    }
  }

  // Enhanced session validation
  async validateSession(sessionData) {
    if (!sessionData || typeof sessionData !== 'object') {
      return false;
    }

    // More flexible validation
    const hasRequiredKeys = Object.keys(sessionData).some(key =>
      key.toLowerCase().includes('wa') ||
      key.includes('WABrowserId') ||
      key.includes('WASecretBundle') ||
      key.includes('WAToken') ||
      key.includes('noise') ||
      key.includes('session')
    );

    if (!hasRequiredKeys) {
      log('warn', 'Session data missing required WhatsApp keys');
      return false;
    }

    const dataSize = JSON.stringify(sessionData).length;
    if (dataSize < 1000) {
      log('warn', `Session data too small: ${dataSize} bytes`);
      return false;
    }

    return true;
  }
}

// Enhanced session save function
async function safelyTriggerSessionSave(client) {
  if (!client) return false;
  
  try {
    // Use direct localStorage extraction to get session data
    const sessionData = await extractSessionData(client);
    
    if (sessionData) {
      const sessionSize = JSON.stringify(sessionData).length;
      log('info', `📥 Got session data to save (${sessionSize} bytes)`);
      
      // Validate session data
      const supabaseStore = client.authStrategy?.store;
      if (supabaseStore && typeof supabaseStore.validateSession === 'function') {
        const isValid = await supabaseStore.validateSession(sessionData);
        if (!isValid) {
          log('warn', 'Session data validation failed');
          return false;
        }
      }

      // Save directly to Supabase store
      if (supabaseStore && typeof supabaseStore.save === 'function') {
        // Make sure client reference is set
        supabaseStore.client = client;

        // Save to Supabase
        await supabaseStore.save({
          session: `RemoteAuth-${SESSION_ID}`,
          sessionData
        });
        log('info', '📥 Session saved to Supabase successfully');

        // Extra: Create a backup copy of session data directly to file system
        try {
          const sessionDir = path.join(__dirname, `.wwebjs_auth/session-${SESSION_ID}`);
          if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
          }

          const backupFile = path.join(sessionDir, 'session_backup.json');
          await fs.promises.writeFile(
            backupFile,
            JSON.stringify(sessionData, null, 2),
            { encoding: 'utf8' }
          );
          log('info', '📥 Created additional filesystem backup of session');
        } catch (backupErr) {
          log('warn', `Failed to create filesystem backup: ${backupErr.message}`);
        }
        return true;
      } else {
        log('warn', 'No save method available on Supabase store');
        return false;
      }
    } else {
      log('warn', '❓ Could not find valid session data for saving');
      return false;
    }
  } catch (err) {
    log('error', `Failed to request session save: ${err.message}`);
    return false;
  }
}

const supabaseStore = new SupabaseStore(supabase, SESSION_ID);
let client = null;
let messageSendQueue = null;

function createWhatsAppClient() {
  try {
    // Ensure auth folder exists with proper structure
    const authDir = path.join(__dirname, '.wwebjs_auth');
    const sessionPath = path.join(authDir, `session-${SESSION_ID}`);

    // Persistent Chrome profile directory for consistent browser fingerprinting
    const chromeProfileDir = path.join(__dirname, '.wwebjs_chrome_profile');

    // Create directories if they don't exist
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
      log('info', `📁 Created auth directory: ${authDir}`);
    }

    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      log('info', `📁 Created session directory: ${sessionPath}`);
    }

    if (!fs.existsSync(chromeProfileDir)) {
      fs.mkdirSync(chromeProfileDir, { recursive: true });
      log('info', `📁 Created Chrome profile directory: ${chromeProfileDir}`);
    }

    // Create RemoteAuth temp session directory structure to prevent ENOENT errors
    const remoteAuthPath = path.join(authDir, `RemoteAuth-${SESSION_ID}`);
    const tempSessionPath = path.join(authDir, `wwebjs_temp_session_${SESSION_ID}`);

    // Ensure RemoteAuth directories exist
    [remoteAuthPath, tempSessionPath].forEach(dirPath => {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        log('info', `📁 Created RemoteAuth directory: ${dirPath}`);

        // Create Default subdirectory to prevent ENOENT during deleteMetadata
        const defaultDir = path.join(dirPath, 'Default');
        if (!fs.existsSync(defaultDir)) {
          fs.mkdirSync(defaultDir, { recursive: true });
          log('info', `📁 Created Default subdirectory: ${defaultDir}`);
        }
      }
    });

    // Add .gitkeep to ensure folder is tracked
    const gitkeepPath = path.join(authDir, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
      fs.writeFileSync(gitkeepPath, '');
      log('info', 'Added .gitkeep to auth directory');
    }

    log('info', `Using auth directory: ${authDir}`);
    log('info', `Using session path: ${sessionPath}`);
    log('info', `Using Chrome profile: ${chromeProfileDir}`);

    return new Client({
      authStrategy: new RemoteAuth({
        clientId: SESSION_ID,
        store: supabaseStore,
        backupSyncIntervalMs: 3600000, // 1 hour - minimum interference (RemoteAuth requires min 60000ms)
        dataPath: authDir, // Use parent directory, not session-specific path
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        args: [
          // ========================================
          // CRITICAL ANTI-DETECTION FLAGS
          // ========================================
          // Hides navigator.webdriver flag that exposes automation
          '--disable-blink-features=AutomationControlled',

          // Persistent browser profile for consistent fingerprinting
          // This prevents WhatsApp from seeing a "new device" on every restart
          `--user-data-dir=${chromeProfileDir}`,
          '--profile-directory=Default',

          // Custom user agent (looks like real Chrome, not Puppeteer)
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

          // Reduced viewport size for memory optimization (was 1920x1080)
          '--window-size=1280,720',

          // ========================================
          // MEMORY OPTIMIZATION FLAGS (CRITICAL FOR 512MB LIMIT)
          // ========================================
          '--disable-dev-shm-usage',           // Prevents /dev/shm issues in Docker/low-memory
          '--disable-accelerated-2d-canvas',   // Reduces GPU usage
          '--disable-gpu',                     // Server environments don't need GPU
          '--no-sandbox',                      // Required for Render.com deployment
          '--disable-setuid-sandbox',          // Required for Render.com deployment

          // Aggressive memory limits for 512MB Render free tier
          '--js-flags=--max-old-space-size=256',  // Reduced from 512MB to 256MB
          '--disable-software-rasterizer',
          '--disable-canvas-aa',
          '--disable-3d-apis',
          '--disable-webgl',
          '--disable-webgl2',

          // Reduce memory usage
          '--memory-pressure-off',
          '--renderer-process-limit=1',
          '--max-gum-fps=15',

          // Disable unnecessary features to save memory
          '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',

          // Language & locale (natural for English users)
          '--lang=en-US',
          '--accept-lang=en-US,en;q=0.9',
        ],
        timeout: 120000,

        // Use puppeteer-extra with stealth plugin instead of default puppeteer
        // This is set globally at the top of the file, so whatsapp-web.js will use it
      },
      qrTimeout: 90000,
      restartOnAuthFail: true,

      // Use stable WhatsApp Web version to avoid breaking changes
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      },
    });
  } catch (err) {
    log('error', `Failed to create WhatsApp client: ${err.message}`);
    return null;
  }
}

function setupClientEvents(c) {
  // Set client reference in store
  if (c.authStrategy && c.authStrategy.store) {
    c.authStrategy.store.client = c;
  }

  // Add error handler to prevent unhandled errors
  c.on('error', (error) => {
    log('error', `Client error: ${error.message}`);
    if (error.stack) {
      log('debug', `Stack trace: ${error.stack}`);
    }
  });

  c.on('qr', async qr => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`;
    log('warn', `📱 Scan QR Code: ${qrUrl}`);

    // Generate QR code as data URL for dashboard
    try {
      const newQRCode = await QRCode.toDataURL(qr);

      // Only update and broadcast if QR code has changed
      if (currentQRCode !== newQRCode) {
        currentQRCode = newQRCode;
        log('info', '📱 New QR Code generated for dashboard');

        // Broadcast to all WebSocket clients
        broadcastToClients({ type: 'qr', qr: currentQRCode, timestamp: Date.now() });
      } else {
        log('debug', '📱 QR Code unchanged, skipping broadcast');
      }
    } catch (err) {
      log('error', `Failed to generate QR code: ${err.message}`);
    }
  });

  c.on('ready', async () => {
    log('info', '✅ WhatsApp client is ready.');
    currentQRCode = null; // Clear QR code when authenticated

    // Set client reference for human behavior notifications
    humanBehavior.client = c;
    log('info', '🔗 Client reference set for human behavior notifications');

    // Broadcast ready status to dashboard
    broadcastToClients({ type: 'ready', authenticated: true });

    // Trigger session save after client is ready with human-like delay
    const delay = humanBehavior.getRandomDelay(3000, 8000);
    setTimeout(async () => {
      try {
        await safelyTriggerSessionSave(c);
      } catch (err) {
        log('warn', `Failed to save session after ready: ${err.message}`);
      }
    }, delay);

    // Set up controlled periodic session saves (every 30 minutes) as safety net
    // This replaces RemoteAuth's automatic backups with our compatible extraction method
    const periodicSaveInterval = setInterval(async () => {
      if (c && typeof c.getState === 'function') {
        try {
          const state = await c.getState();
          if (state === 'CONNECTED') {
            log('debug', '💾 Periodic session save starting (30min interval)');
            await safelyTriggerSessionSave(c);
          } else {
            log('debug', `⏭️ Skipping periodic save - client state: ${state}`);
          }
        } catch (err) {
          log('warn', `Periodic session save failed: ${err.message}`);
        }
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Clean up interval on disconnect
    c.once('disconnected', () => {
      clearInterval(periodicSaveInterval);
      log('debug', '🧹 Cleared periodic save interval');
    });
  });

  c.on('authenticated', async () => {
    log('info', '🔐 Client authenticated.');

    // Broadcast authenticating status to dashboard
    broadcastToClients({ type: 'authenticated', status: 'authenticating' });

    // Note: Session save removed here to avoid duplicate with 'ready' event
    // Session will be saved when 'ready' event fires (client fully initialized)
  });

  c.on('remote_session_saved', () => {
    log('debug', '💾 RemoteAuth save attempt completed (check logs above for actual result)');
  });

  c.on('disconnected', async reason => {
    log('warn', `Client disconnected: ${reason}`);
    
    // Try to save session before destroying
    if (client) {
      try {
        await safelyTriggerSessionSave(client);
        await client.destroy();
      } catch (err) {
        log('error', `Error during disconnect cleanup: ${err.message}`);
      }
      client = null;
    }
    
    // Exponential backoff for reconnection with human-like randomness
    const attemptReconnection = (attempt = 1) => {
      const baseDelay = Math.min(Math.pow(2, attempt) * 1000, 60000);
      const randomDelay = baseDelay + (Math.random() * 10000); // Add up to 10s randomness
      log('info', `Will attempt reconnection (#${attempt}) in ${randomDelay/1000} seconds`);
      
      setTimeout(async () => {
        try {
          await startClient();
          
          const state = await client?.getState();
          if (!client || state !== 'CONNECTED') {
            log('warn', `Reconnection attempt #${attempt} failed. State: ${state || 'No client'}`);
            attemptReconnection(attempt + 1);
          } else {
            log('info', `✅ Reconnected successfully after ${attempt} attempts`);
          }
        } catch (err) {
          log('error', `Error during reconnection attempt #${attempt}: ${err.message}`);
          attemptReconnection(attempt + 1);
        }
      }, randomDelay);
    };
    
    attemptReconnection();
  });

  c.on('auth_failure', async () => {
    log('error', '❌ Auth failed. Clearing session.');
    try {
      await supabaseStore.delete({ session: SESSION_ID });
      log('info', 'Session deleted. Will attempt to reinitialize...');
      client = null;
      
      // Add human-like delay before restart
      const delay = humanBehavior.getRandomDelay(8000, 15000);
      setTimeout(startClient, delay);
    } catch (err) {
      log('error', `Failed to clean up after auth failure: ${err.message}`);
      process.exit(1);
    }
  });

  c.on('message', handleIncomingMessage);
}

let messageCount = 0;

async function handleIncomingMessage(msg) {
  // Only process messages from group chats
  if (!msg.from.endsWith('@g.us')) {
    return;
  }

  const groupId = msg.from;
  const senderId = msg.author || msg.from;
  const text = msg.body || '';
  const messageId = msg?.id?.id || msg?.id?._serialized || '';

  // Log incoming message with group ID
  log('info', `📨 Message received from group: ${groupId}`);

  // Skip if message was already processed
  if (humanBehavior.wasMessageProcessed(messageId)) {
    log('debug', `🔄 Message already processed, skipping [Group: ${groupId}]`);
    return;
  }

  let replyInfo = null;
  let hasReply = false;

  try {
    const quoted = await msg.getQuotedMessage?.();
    if (quoted?.id) {
      hasReply = true;
      replyInfo = {
        message_id: quoted?.id?.id || quoted?.id?._serialized || null,
        text: quoted?.body || null,
      };
    }
  } catch (err) {
    log('warn', `⚠️ Failed to get quoted message: ${err.message}`);
  }

  // Check for different trigger conditions
  const isValuationRequest = text.toLowerCase().includes('valuation request:');

  const isValuationReply = hasReply && replyInfo?.message_id;

  const isInterestRateMessage = text.toLowerCase().includes('keyquest mortgage team');

  const isBankRatesUpdateMessage = text.toLowerCase().includes('update bank rates');

  const isRatePackageUpdate = text.toLowerCase().includes('rate package update:');

  // Skip if message doesn't match any trigger conditions
  if (!isValuationRequest && !isValuationReply && !isInterestRateMessage && !isBankRatesUpdateMessage && !isRatePackageUpdate) {
    log('info', `🚫 Ignored message - no trigger keywords found [Group: ${groupId}]`);
    return;
  }

  // Log what triggered the message processing
  if (isValuationRequest) {
    log('info', `📊 Valuation request detected (template format) [Group: ${groupId}]`);
  }

  if (isValuationReply) {
    log('info', `📨 Banker reply detected (quoted message) [Group: ${groupId}]`);
  }

  if (isInterestRateMessage) {
    log('info', `💰 Interest rate message detected [Group: ${groupId}]`);
  }

  if (isBankRatesUpdateMessage) {
    log('info', `🏦 Bank rates update message detected [Group: ${groupId}]`);
  }

  if (isRatePackageUpdate) {
    log('info', `📦 Rate package update detected (n8n webhook) [Group: ${groupId}]`);
  }

  // Memory logging every 50 messages
  messageCount++;
  if (messageCount % 50 === 0) {
    const mem = process.memoryUsage();
    const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
    log('info', `🧠 Memory usage — RSS: ${rssMB} MB, Heap: ${heapMB} MB`);

    if (parseFloat(rssMB) > 300) {
      log('warn', '⚠️ RSS memory usage above 300MB. Consider restarting or increasing instance size.');
    }
  }

  // Determine message type with priority: valuation_reply > valuation_request > rate_package_update > bank_rates_update > interest_rate
  let messageType;
  if (isValuationReply) {
    messageType = 'valuation_reply';
  } else if (isValuationRequest) {
    messageType = 'valuation_request';
  } else if (isRatePackageUpdate) {
    messageType = 'rate_package_update';
  } else if (isBankRatesUpdateMessage) {
    messageType = 'bank_rates_update';
  } else {
    messageType = 'interest_rate';
  }

  const payload = {
    message: msg,
    groupId,
    senderId,
    messageId,
    hasReply,
    replyInfo,
    messageType,
    timestamp: new Date(msg.timestamp * 1000).toISOString(),
  };

  // Add message to human behavior queue instead of processing immediately
  humanBehavior.addToQueue({ msg, payload });
  log('info', `📝 Message added to processing queue with human-like timing [Group: ${groupId}] [Type: ${messageType}]`);
}

async function startClient() {
  if (client) {
    log('info', '⏳ Client already exists, skipping re-init.');
    return;
  }

  log('info', '🚀 Starting WhatsApp client...');
  client = createWhatsAppClient();
  
  if (!client) {
    log('error', '❌ Failed to create WhatsApp client');
    return;
  }

  setupClientEvents(client);

  // Initialize client in background - don't block on authentication
  // QR code will be emitted via 'qr' event, authentication via 'ready' event
  log('info', '⏳ Initializing WhatsApp client in background...');

  client.initialize().then(() => {
    log('info', '✅ WhatsApp client initialized successfully.');

    // Initialize message send queue after successful init
    if (!messageSendQueue) {
      messageSendQueue = new MessageSendQueue(client);
      log('info', '📬 Message send queue initialized with priority system');
    }

    // Set client on workflow engine after initialization
    workflowEngine.setClient(client);
    workflowEngine.setMessageQueue(messageSendQueue);
  }).catch(err => {
    log('error', `❌ WhatsApp client initialization failed: ${err.message}`);

    // Only nullify client on non-timeout errors
    if (!err.message.includes('Execution context was destroyed') &&
        !err.message.includes('timeout')) {
      client = null;
      workflowEngine.setClient(null);
      log('error', '🔄 Client set to null - will retry on next startClient() call');
    } else {
      log('warn', '⚠️ Client initialization issue - keeping client for QR scan');
    }
  });
}

// Express App Setup
const app = express();
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  log('warn', `Received ${signal}. Shutting down gracefully...`);
  
  server.close(() => {
    log('info', 'HTTP server closed');
  });
  
  if (client) {
    try {
      log('info', 'Saving session before shutdown...');
      await safelyTriggerSessionSave(client);
      log('info', 'Destroying WhatsApp client...');
      await client.destroy();
      log('info', 'WhatsApp client destroyed successfully');
    } catch (err) {
      log('error', `Error destroying client: ${err.message}`);
    }
  }
  
  setTimeout(() => {
    log('info', 'Exiting process...');
    process.exit(0);
  }, 3000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => {
  // Handle RemoteAuth ENOENT errors gracefully (expected on fresh deployments)
  if (reason && reason.code === 'ENOENT' && reason.path && reason.path.includes('wwebjs_temp_session')) {
    log('warn', `⚠️ RemoteAuth directory error (non-critical): ${reason.path}`);
    log('info', 'This is expected on first runs or when session directory is incomplete');
  } else {
    log('error', 'Unhandled Rejection at:', promise, 'reason:', reason);
  }
});

// WebSocket clients storage
const wsClients = new Set();

// Broadcast function for WebSocket clients
function broadcastToClients(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Routes
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (_, res) => {
  res.status(200).json({
    status: '✅ Bot running',
    sessionId: SESSION_ID,
    version: BOT_VERSION,
    uptimeMinutes: Math.floor((Date.now() - startedAt) / 60000),
    humanBehavior: humanBehavior.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

// QR Code endpoint
app.get('/qr-code', async (_, res) => {
  try {
    if (currentQRCode) {
      res.status(200).json({
        qr: currentQRCode,
        authenticated: false,
        timestamp: Date.now()
      });
    } else if (client) {
      const state = await client.getState();
      if (state === 'CONNECTED') {
        res.status(200).json({
          qr: null,
          authenticated: true,
          state,
          timestamp: Date.now()
        });
      } else {
        res.status(200).json({
          qr: null,
          authenticated: false,
          state,
          message: 'Waiting for QR code...',
          timestamp: Date.now()
        });
      }
    } else {
      res.status(200).json({
        qr: null,
        authenticated: false,
        message: 'Client not initialized',
        timestamp: Date.now()
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: Date.now()
    });
  }
});

// Workflows endpoint
app.get('/workflows', (_, res) => {
  res.status(200).json({
    active: workflowEngine.getActiveWorkflows(),
    registered: Array.from(workflowEngine.workflowHandlers.keys())
  });
});

// Enhanced send message endpoint with human behavior
app.post('/send-message', async (req, res) => {
  const { jid, groupId, message, imageUrl, priority = 'normal' } = req.body;

  // Support both jid and groupId parameters
  const targetId = jid || groupId;

  if (!targetId || (!message && !imageUrl)) {
    return res.status(400).json({
      success: false,
      error: 'Missing target ID (jid/groupId) or message content (message/imageUrl)'
    });
  }

  if (!client || !messageSendQueue) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp client or message queue not ready'
    });
  }

  // Validate priority
  const validPriorities = ['critical', 'high', 'normal', 'low'];
  const messagePriority = validPriorities.includes(priority) ? priority : 'normal';

  // Check rate limits for sending messages (skip for critical priority)
  if (messagePriority !== 'critical') {
    const rateLimitCheck = humanBehavior.canProcessMessage();
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded or bot is on break',
        reason: rateLimitCheck.reason
      });
    }
  }

  try {
    let formattedId = targetId;
    
    // Format ID based on type (group or individual)
    if (targetId.includes('@g.us')) {
      // Already a group ID
      formattedId = targetId;
    } else if (targetId.includes('@c.us')) {
      // Already an individual ID
      formattedId = targetId;
    } else {
      // Need to determine if it's a group or individual
      // If it contains letters, assume it's a group ID that needs @g.us
      // If it's only numbers, assume it's an individual that needs @c.us
      if (/[a-zA-Z]/.test(targetId)) {
        formattedId = targetId.endsWith('@g.us') ? targetId : `${targetId}@g.us`;
      } else {
        formattedId = targetId.endsWith('@c.us') ? targetId : `${targetId}@c.us`;
      }
    }

    // Prepare message for queue
    let sentMessage;
    let messageOptions = {};

    // Prepare media if imageUrl provided
    if (imageUrl) {
      try {
        const media = await MessageMedia.fromUrl(imageUrl);
        messageOptions.media = media;
        log('info', `📸 Image prepared for queue [${messagePriority}] to ${formattedId}`);
      } catch (mediaErr) {
        log('error', `Failed to prepare image: ${mediaErr.message}`);
        // Fallback to text message if image fails
        if (!message) {
          throw mediaErr;
        }
      }
    }

    // Send via message queue with priority
    log('info', `📤 Queuing message [${messagePriority}] to ${formattedId}`);
    sentMessage = await messageSendQueue.send(
      formattedId,
      message || '',
      messagePriority,
      messageOptions
    );

    // Record the action
    humanBehavior.recordMessageProcessed(`sent_${Date.now()}`);

    // Return original WhatsApp message ID format
    const messageId = sentMessage.id?.id || sentMessage.id?._serialized || sentMessage.id;
    
    return res.status(200).json({ 
      success: true, 
      messageId: messageId,
      target: formattedId,
      type: imageUrl ? 'media' : 'text'
    });

  } catch (err) {
    log('error', `Failed to send message: ${err.message}`);
    return res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Enhanced session management endpoints
app.post('/extract-session', async (req, res) => {
  try {
    let success = false;
    
    // Try to extract from live client first
    if (client) {
      const extractedData = await extractSessionData(client);
      if (extractedData) {
        await supabaseStore.save({ sessionData: extractedData });
        success = true;
        log('info', 'Live session data extracted and saved');
      }
    }
    
    // Fallback to local files if live extraction failed
    if (!success) {
      success = await supabaseStore.extractLocalSession();
    }
    
    res.status(200).json({ 
      success, 
      message: success ? 'Session extracted and saved to Supabase' : 'No valid session found' 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

app.delete('/clear-session', async (req, res) => {
  try {
    await supabaseStore.delete({ session: SESSION_ID });
    res.status(200).json({ 
      success: true, 
      message: 'Session cleared from Supabase' 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Manual session save endpoint
app.post('/save-session', async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp client not ready'
      });
    }

    const success = await safelyTriggerSessionSave(client);
    res.status(200).json({
      success,
      message: success ? 'Session saved successfully' : 'Failed to save session'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Production-ready logout endpoint with comprehensive cleanup
app.post('/logout', async (req, res) => {
  try {
    log('info', '🚪 Logout requested - starting comprehensive cleanup...');

    const cleanupResults = {
      clientLogout: false,
      clientDestroy: false,
      supabaseSessionDelete: false,
      supabaseBackupDelete: false,
      chromeProfileCleanup: false,
      localSessionCleanup: false,
      qrCodeCleared: false
    };

    // Step 1: Logout from WhatsApp if client exists
    if (client) {
      try {
        log('info', '1️⃣ Logging out from WhatsApp...');
        await client.logout();
        cleanupResults.clientLogout = true;
        log('info', '✅ WhatsApp logout successful');
      } catch (logoutErr) {
        log('warn', `⚠️ Logout failed (may already be logged out): ${logoutErr.message}`);
        // Continue cleanup even if logout fails
      }

      // Step 2: Destroy client instance
      try {
        log('info', '2️⃣ Destroying WhatsApp client...');
        await client.destroy();
        client = null;
        cleanupResults.clientDestroy = true;
        log('info', '✅ Client destroyed successfully');
      } catch (destroyErr) {
        log('error', `❌ Client destroy failed: ${destroyErr.message}`);
        client = null; // Force null even if destroy fails
      }
    } else {
      log('warn', '⚠️ No active client to logout');
    }

    // Step 3: Clear session from Supabase
    try {
      log('info', '3️⃣ Deleting session from Supabase...');
      const sessionKey = `RemoteAuth-${SESSION_ID}`;
      // Pass the full RemoteAuth-prefixed key to delete the correct session
      await supabaseStore.delete({ session: sessionKey });
      cleanupResults.supabaseSessionDelete = true;
      log('info', `✅ Session deleted: ${sessionKey}`);
    } catch (supabaseErr) {
      log('error', `❌ Supabase session delete failed: ${supabaseErr.message}`);
    }

    // Step 4: Clear backup session from Supabase
    try {
      log('info', '4️⃣ Deleting backup session from Supabase...');
      const backupKey = `RemoteAuth-${SESSION_ID}_backup`;
      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_key', backupKey);

      if (!error) {
        cleanupResults.supabaseBackupDelete = true;
        log('info', `✅ Backup session deleted: ${backupKey}`);
      } else {
        log('warn', `⚠️ Backup delete warning: ${error.message}`);
      }
    } catch (backupErr) {
      log('warn', `⚠️ Backup session delete failed: ${backupErr.message}`);
    }

    // Step 5: Clear Chrome profile directory
    try {
      log('info', '5️⃣ Cleaning Chrome profile...');
      // Use correct path - matches createWhatsAppClient() line 955
      const chromeProfileDir = path.join(__dirname, '.wwebjs_chrome_profile');

      if (fs.existsSync(chromeProfileDir)) {
        fs.rmSync(chromeProfileDir, { recursive: true, force: true });
        log('info', '✅ Chrome profile cleared');
        cleanupResults.chromeProfileCleanup = true;
      } else {
        log('info', '✅ Chrome profile already clean (not found)');
        cleanupResults.chromeProfileCleanup = true;
      }
    } catch (chromeErr) {
      log('error', `❌ Chrome profile cleanup failed: ${chromeErr.message}`);
    }

    // Step 6: Clear local session directory
    try {
      log('info', '6️⃣ Cleaning local session directory...');
      const sessionPath = path.join(__dirname, `.wwebjs_auth/session-${SESSION_ID}`);

      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        log('info', '✅ Local session directory cleared');
        cleanupResults.localSessionCleanup = true;
      } else {
        log('info', '✅ Local session already clean (not found)');
        cleanupResults.localSessionCleanup = true;
      }
    } catch (sessionErr) {
      log('error', `❌ Local session cleanup failed: ${sessionErr.message}`);
    }

    // Step 7: Clear temporary session directories
    try {
      log('info', '7️⃣ Cleaning temporary session directories...');
      const authDir = path.join(__dirname, '.wwebjs_auth');
      const tempSessionPath = path.join(authDir, `wwebjs_temp_session_${SESSION_ID}`);

      if (fs.existsSync(tempSessionPath)) {
        fs.rmSync(tempSessionPath, { recursive: true, force: true });
        log('info', '✅ Temporary session directory cleared');
      } else {
        log('info', '✅ Temporary session already clean (not found)');
      }
    } catch (tempErr) {
      log('warn', `⚠️ Temporary session cleanup warning: ${tempErr.message}`);
    }

    // Step 8: Clear QR code from memory
    currentQRCode = null;
    cleanupResults.qrCodeCleared = true;
    log('info', '✅ QR code cleared from memory');

    // Step 9: Broadcast logout status to all WebSocket clients
    try {
      broadcastToClients({
        type: 'logout',
        message: 'WhatsApp session logged out',
        timestamp: Date.now()
      });
      log('info', '✅ Logout broadcast to WebSocket clients');
    } catch (broadcastErr) {
      log('warn', `⚠️ WebSocket broadcast failed: ${broadcastErr.message}`);
    }

    // Step 10: Reset human behavior manager state
    try {
      humanBehavior.client = null;
      humanBehavior.processedMessages.clear();
      humanBehavior.messageQueue = [];
      log('info', '✅ Human behavior manager reset');
    } catch (behaviorErr) {
      log('warn', `⚠️ Human behavior reset warning: ${behaviorErr.message}`);
    }

    const successCount = Object.values(cleanupResults).filter(v => v === true).length;
    const totalSteps = Object.keys(cleanupResults).length;

    log('info', `🎉 Logout complete: ${successCount}/${totalSteps} cleanup steps successful`);

    // Step 11: Wait for cleanup to settle, then restart client for new QR code
    setTimeout(async () => {
      try {
        log('info', '🔄 Restarting client to generate new QR code...');

        // Ensure client is truly null before restarting
        if (client) {
          log('warn', '⚠️ Client still exists, forcing null...');
          client = null;
        }

        // Give filesystem and processes time to fully release resources
        await new Promise(resolve => setTimeout(resolve, 1000));

        await startClient();
        log('info', '✅ Client restarted - new QR code should be available');
      } catch (restartErr) {
        log('error', `❌ Failed to restart client after logout: ${restartErr.message}`);
      }
    }, 3000); // 3 second delay to ensure cleanup completes and processes release

    res.status(200).json({
      success: true,
      message: 'Logout and cleanup completed successfully',
      details: cleanupResults,
      summary: `${successCount}/${totalSteps} cleanup steps completed`,
      ready_for_new_login: true
    });

  } catch (err) {
    log('error', `❌ Logout process failed: ${err.message}`);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Logout encountered errors, but partial cleanup may have occurred'
    });
  }
});

// Human behavior control endpoints
app.get('/human-status', (req, res) => {
  res.status(200).json({
    success: true,
    status: humanBehavior.getStatus(),
    config: HUMAN_CONFIG
  });
});

// ============================================
// WORKFLOW BUILDER API ENDPOINTS
// ============================================

// Workflow Management
app.post('/api/workflows/create', async (req, res) => {
  const result = await workflowAPI.createWorkflow(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.get('/api/workflows/list', async (req, res) => {
  const filters = {
    is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    trigger_type: req.query.trigger_type
  };
  const result = await workflowAPI.getWorkflows(filters);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/workflows/:id', async (req, res) => {
  const result = await workflowAPI.getWorkflow(req.params.id);
  res.status(result.success ? 200 : 404).json(result);
});

app.put('/api/workflows/:id/update', async (req, res) => {
  const result = await workflowAPI.updateWorkflow(req.params.id, req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.delete('/api/workflows/:id/delete', async (req, res) => {
  const result = await workflowAPI.deleteWorkflow(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/workflows/:id/toggle', async (req, res) => {
  const { is_active } = req.body;
  const result = await workflowAPI.toggleWorkflow(req.params.id, is_active);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/workflows/:id/duplicate', async (req, res) => {
  const { new_name } = req.body;
  const result = await workflowAPI.duplicateWorkflow(req.params.id, new_name);
  res.status(result.success ? 201 : 400).json(result);
});

app.get('/api/workflows/:id/executions', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const result = await workflowAPI.getExecutionHistory(req.params.id, limit);
  res.status(result.success ? 200 : 400).json(result);
});

// Template Management
app.post('/api/templates/create', async (req, res) => {
  const result = await templateAPI.createTemplate(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.get('/api/templates/list', async (req, res) => {
  const filters = {
    category: req.query.category,
    search: req.query.search
  };
  const result = await templateAPI.getTemplates(filters);
  res.status(result.success ? 200 : 400).json(result);
});

// IMPORTANT: Specific routes must come BEFORE parameterized routes
// Otherwise Express will match '/api/templates/categories' to '/:id' route
app.get('/api/templates/categories', async (req, res) => {
  const result = await templateAPI.getCategories();
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/templates/:id', async (req, res) => {
  const result = await templateAPI.getTemplate(req.params.id);
  res.status(result.success ? 200 : 404).json(result);
});

app.put('/api/templates/:id/update', async (req, res) => {
  const result = await templateAPI.updateTemplate(req.params.id, req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.delete('/api/templates/:id/delete', async (req, res) => {
  const result = await templateAPI.deleteTemplate(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/templates/:id/duplicate', async (req, res) => {
  const { new_name } = req.body;
  const result = await templateAPI.duplicateTemplate(req.params.id, new_name);
  res.status(result.success ? 201 : 400).json(result);
});

app.post('/api/templates/:id/preview', async (req, res) => {
  const result = await templateAPI.previewTemplate(req.params.id, req.body.sample_data || {});
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/templates/validate', async (req, res) => {
  const result = templateAPI.validateTemplate(req.body);
  res.status(200).json(result);
});

// Contact List Management
app.post('/api/contacts/create', async (req, res) => {
  const result = await contactAPI.createContactList(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.get('/api/contacts/list', async (req, res) => {
  const filters = {
    source: req.query.source,
    search: req.query.search,
    tag: req.query.tag
  };
  const result = await contactAPI.getContactLists(filters);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/contacts/:id', async (req, res) => {
  const result = await contactAPI.getContactList(req.params.id);
  res.status(result.success ? 200 : 404).json(result);
});

app.put('/api/contacts/:id/update', async (req, res) => {
  const result = await contactAPI.updateContactList(req.params.id, req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.delete('/api/contacts/:id/delete', async (req, res) => {
  const result = await contactAPI.deleteContactList(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/contacts/:id/add', async (req, res) => {
  const { contacts } = req.body;
  const result = await contactAPI.addContacts(req.params.id, contacts);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/contacts/:id/remove', async (req, res) => {
  const { phones } = req.body;
  const result = await contactAPI.removeContacts(req.params.id, phones);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/contacts/import/csv', async (req, res) => {
  const { csv_data, list_name, mapping } = req.body;
  const result = await contactAPI.importFromCSV(csv_data, list_name, mapping);
  res.status(result.success ? 201 : 400).json(result);
});

app.get('/api/contacts/groups/whatsapp', async (req, res) => {
  const result = await contactAPI.getWhatsAppGroups(client);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/contacts/:id/statistics', async (req, res) => {
  const result = await contactAPI.getStatistics(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

// ============================================
// BROADCAST CONTACTS API ENDPOINTS (Individual Contacts)
// ============================================

// Get all broadcast contacts across all lists
app.get('/api/broadcast-contacts', async (req, res) => {
  const filters = {
    search: req.query.search,
    tier: req.query.tier,
    list_id: req.query.list_id,
    is_active: req.query.is_active
  };
  const result = await broadcastContactAPI.getAllContacts(filters);
  res.status(result.success ? 200 : 400).json(result);
});

// Get a single broadcast contact
app.get('/api/broadcast-contacts/:id', async (req, res) => {
  const result = await broadcastContactAPI.getContact(req.params.id);
  res.status(result.success ? 200 : 404).json(result);
});

// Create contact list with broadcast contacts
app.post('/api/broadcast-contacts/create-list', async (req, res) => {
  const result = await broadcastContactAPI.createContactList(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

// Import contacts from CSV
app.post('/api/broadcast-contacts/import-csv', async (req, res) => {
  const { csv_data, list_name, description } = req.body;
  const result = await broadcastContactAPI.importFromCSV(csv_data, list_name, description);
  res.status(result.success ? 201 : 400).json(result);
});

// Update a single broadcast contact
app.put('/api/broadcast-contacts/:id', async (req, res) => {
  const result = await broadcastContactAPI.updateContact(req.params.id, req.body);
  res.status(result.success ? 200 : 400).json(result);
});

// Delete a single broadcast contact
app.delete('/api/broadcast-contacts/:id', async (req, res) => {
  const result = await broadcastContactAPI.deleteContact(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

// Bulk delete broadcast contacts
app.delete('/api/broadcast-contacts/bulk', async (req, res) => {
  const { ids } = req.body;
  const result = await broadcastContactAPI.bulkDeleteContacts(ids);
  res.status(result.success ? 200 : 400).json(result);
});

// ============================================
// BROADCAST MESSAGING API ENDPOINTS
// ============================================

// Helper function to send broadcast completion notification
async function sendBroadcastNotification(phoneNumber, summary) {
  try {
    // Format phone number for WhatsApp
    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;

    // Build notification message
    let notificationMessage = `📢 *Broadcast Summary*\n\n`;

    if (summary.status === 'completed') {
      notificationMessage += `Status: ✅ Completed\n`;
    } else if (summary.status === 'failed') {
      notificationMessage += `Status: ❌ Failed\n`;
    } else if (summary.status === 'disrupted') {
      notificationMessage += `Status: ⚠️ Disrupted\n`;
    }

    notificationMessage += `Total Contacts: ${summary.total}\n`;
    notificationMessage += `Successfully Sent: ${summary.sent}\n`;
    notificationMessage += `Failed: ${summary.failed}\n\n`;

    // Include last sent contact if available
    if (summary.last_sent_contact) {
      notificationMessage += `Last Sent To: ${summary.last_sent_contact.name}\n`;
      notificationMessage += `Phone: ${summary.last_sent_contact.phone}\n\n`;
    }

    notificationMessage += `Broadcast ID: ${summary.broadcast_id}\n`;
    notificationMessage += `Completed at: ${summary.completed_at}`;

    // Send via internal API
    const response = await axios.post(`${process.env.APP_URL || 'http://localhost:3000'}/send-message`, {
      jid,
      message: notificationMessage
    });

    if (response.status === 200) {
      log('info', `✅ Notification sent to ${phoneNumber}`);
    } else {
      log('error', `❌ Failed to send notification to ${phoneNumber}`);
    }
  } catch (error) {
    log('error', `❌ Error sending notification: ${error.message}`);
  }
}

// Image upload endpoint for broadcast messages
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
  try {
    // Check if ImageKit is configured
    if (!imageUploadAPI) {
      return res.status(503).json({
        success: false,
        error: 'Image upload service not configured. Please contact administrator.'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    // Upload to ImageKit
    const result = await imageUploadAPI.uploadImage(
      req.file.buffer,
      req.file.originalname,
      'broadcast-images'
    );

    if (result.success) {
      log('info', `✅ Image uploaded: ${result.name} (${result.url})`);
      return res.json({
        success: true,
        url: result.url,
        fileId: result.fileId,
        name: result.name,
        size: result.size,
        dimensions: {
          width: result.width,
          height: result.height
        }
      });
    } else {
      log('error', `❌ Image upload failed: ${result.error}`);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    log('error', `❌ Image upload error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send interest rate broadcast to selected contacts
app.post('/api/broadcast/interest-rate', async (req, res) => {
  let { contacts, message, image_url, batch_size, delay_between_messages, notification_contact } = req.body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ success: false, error: 'No contacts provided' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Message cannot be empty' });
  }

  // Enforce minimum delay of 15 seconds (15000ms)
  if (!delay_between_messages || delay_between_messages < 15000) {
    log('warn', `⚠️ Delay too short (${delay_between_messages}ms), enforcing 15s minimum`);
    delay_between_messages = 15000;
  }

  try {
    // Generate unique broadcast ID
    const broadcastId = `broadcast_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create broadcast execution record in database
    const { data: execution, error: execError } = await supabase
      .from('broadcast_executions')
      .insert({
        broadcast_id: broadcastId,
        name: `Interest Rate Broadcast ${new Date().toLocaleString()}`,
        status: 'running',
        total_contacts: contacts.length,
        current_index: 0,
        sent_count: 0,
        failed_count: 0,
        batch_size: batch_size || 1,
        delay_between_messages: delay_between_messages || 20000, // Default 20 seconds
        message_content: message,
        message_template: message,
        image_url: image_url || null,
        notification_contact: notification_contact || null,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (execError) {
      log('error', `❌ Failed to create broadcast execution: ${execError.message}`);
      return res.status(500).json({ success: false, error: 'Failed to initialize broadcast' });
    }

    // Create broadcast message records for each contact
    const messageRecords = contacts.map((contact, index) => ({
      execution_id: execution.id,
      contact_id: contact.id,
      recipient_name: contact.name,
      recipient_phone: contact.phone,
      status: 'pending',
      queued_at: new Date().toISOString(),
      send_order: index + 1
    }));

    const { error: msgError } = await supabase
      .from('broadcast_messages')
      .insert(messageRecords);

    if (msgError) {
      log('error', `❌ Failed to create message records: ${msgError.message}`);
    }

    // Start broadcast in background (don't wait for completion)
    setTimeout(async () => {
      const delayMs = delay_between_messages || 7000;
      let successCount = 0;
      let failedCount = 0;
      let lastSentContact = null; // Track the last successfully sent contact

      try {
        log('info', `📢 Starting broadcast ${broadcastId} to ${contacts.length} contacts (delay: ${delayMs}ms)`);

      // Emit initial status via WebSocket
      broadcastToClients({
        type: 'broadcast_status',
        data: {
          broadcast_id: broadcastId,
          execution_id: execution.id,
          status: 'running',
          total: contacts.length,
          sent: 0,
          failed: 0,
          current_index: 0,
          progress: 0
        }
      });

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        let messageStatus = 'failed';
        let errorMessage = null;

        try {
          // Replace {name} placeholder with actual contact name
          const personalizedMessage = message.replace(/{name}/g, contact.name || 'Valued Customer');

          // Format phone number for WhatsApp (e.g., 6591234567@c.us)
          const jid = contact.phone.includes('@') ? contact.phone : `${contact.phone}@c.us`;

          // Update message status to 'sending'
          await supabase
            .from('broadcast_messages')
            .update({ status: 'sending' })
            .eq('execution_id', execution.id)
            .eq('contact_id', contact.id);

          // Send message via internal API with low priority (broadcasts are bulk operations)
          const response = await axios.post(`${process.env.APP_URL || 'http://localhost:3000'}/send-message`, {
            jid,
            message: personalizedMessage,
            imageUrl: image_url || null,
            priority: 'low'  // Low priority for broadcast messages
          });

          if (response.status === 200) {
            successCount++;
            messageStatus = 'sent';
            lastSentContact = { name: contact.name, phone: contact.phone }; // Track last sent contact
            log('info', `✅ Sent to ${contact.name} (${contact.phone}) [${successCount}/${contacts.length}]`);
          } else {
            failedCount++;
            errorMessage = 'Failed to send message';
            log('error', `❌ Failed to send to ${contact.name} (${contact.phone})`);
          }

        } catch (error) {
          failedCount++;
          errorMessage = error.message;
          log('error', `❌ Error sending to ${contact.name}: ${error.message}`);
        }

        // Update message record with result
        await supabase
          .from('broadcast_messages')
          .update({
            status: messageStatus,
            sent_at: messageStatus === 'sent' ? new Date().toISOString() : null,
            error_message: errorMessage
          })
          .eq('execution_id', execution.id)
          .eq('contact_id', contact.id);

        // Update broadcast execution progress
        const progress = Math.round(((i + 1) / contacts.length) * 100);
        await supabase
          .from('broadcast_executions')
          .update({
            current_index: i + 1,
            sent_count: successCount,
            failed_count: failedCount,
            last_sent_at: new Date().toISOString()
          })
          .eq('id', execution.id);

        // Emit progress update via WebSocket
        broadcastToClients({
          type: 'broadcast_status',
          data: {
            broadcast_id: broadcastId,
            execution_id: execution.id,
            status: 'running',
            total: contacts.length,
            sent: successCount,
            failed: failedCount,
            current_index: i + 1,
            progress: progress,
            current_contact: {
              id: contact.id,
              name: contact.name,
              phone: contact.phone,
              status: messageStatus
            }
          }
        });

        // Wait between messages (except for last message)
        if (i < contacts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      // Mark broadcast as completed
      await supabase
        .from('broadcast_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', execution.id);

      // Emit completion status via WebSocket
      broadcastToClients({
        type: 'broadcast_status',
        data: {
          broadcast_id: broadcastId,
          execution_id: execution.id,
          status: 'completed',
          total: contacts.length,
          sent: successCount,
          failed: failedCount,
          current_index: contacts.length,
          progress: 100
        }
      });

      log('info', `📊 Broadcast complete: ${successCount} sent, ${failedCount} failed`);

        // Send notification to notification contact if provided
        if (execution.notification_contact) {
          await sendBroadcastNotification(
            execution.notification_contact,
            {
              status: 'completed',
              broadcast_id: broadcastId,
              total: contacts.length,
              sent: successCount,
              failed: failedCount,
              last_sent_contact: lastSentContact,
              completed_at: new Date().toLocaleString()
            }
          );
        }
      } catch (error) {
        // Handle broadcast failure/disruption
        log('error', `❌ Broadcast failed: ${error.message}`);

        // Mark broadcast as failed
        await supabase
          .from('broadcast_executions')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', execution.id);

        // Emit failure status via WebSocket
        broadcastToClients({
          type: 'broadcast_status',
          data: {
            broadcast_id: broadcastId,
            execution_id: execution.id,
            status: 'failed',
            total: contacts.length,
            sent: successCount,
            failed: failedCount,
            current_index: successCount + failedCount,
            progress: Math.round(((successCount + failedCount) / contacts.length) * 100),
            error: error.message
          }
        });

        // Send notification to notification contact if provided
        if (execution.notification_contact) {
          await sendBroadcastNotification(
            execution.notification_contact,
            {
              status: 'failed',
              broadcast_id: broadcastId,
              total: contacts.length,
              sent: successCount,
              failed: failedCount,
              last_sent_contact: lastSentContact,
              completed_at: new Date().toLocaleString()
            }
          );
        }
      }
    }, 100);

    // Return immediately to frontend
    res.json({
      success: true,
      message: `Broadcast started for ${contacts.length} contacts`,
      data: {
        broadcast_id: broadcastId,
        execution_id: execution.id,
        total: contacts.length,
        delay_between_messages
      }
    });

  } catch (error) {
    log('error', `❌ Broadcast error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get broadcast status by broadcast_id or execution_id
app.get('/api/broadcast/status/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Try to find execution by broadcast_id first, then by execution_id
    let query = supabase
      .from('broadcast_executions')
      .select('*');

    // Check if ID is numeric (execution_id) or string (broadcast_id)
    if (id.startsWith('broadcast_')) {
      query = query.eq('broadcast_id', id);
    } else {
      query = query.eq('id', parseInt(id));
    }

    const { data: execution, error: execError } = await query.single();

    if (execError || !execution) {
      return res.status(404).json({
        success: false,
        error: 'Broadcast not found'
      });
    }

    // Get detailed message status
    const { data: messages, error: msgError } = await supabase
      .from('broadcast_messages')
      .select('*')
      .eq('execution_id', execution.id)
      .order('send_order', { ascending: true });

    if (msgError) {
      log('error', `❌ Error fetching broadcast messages: ${msgError.message}`);
    }

    res.json({
      success: true,
      data: {
        execution: execution,
        messages: messages || [],
        summary: {
          broadcast_id: execution.broadcast_id,
          execution_id: execution.id,
          status: execution.status,
          total: execution.total_contacts,
          sent: execution.sent_count,
          failed: execution.failed_count,
          current_index: execution.current_index,
          progress: Math.round((execution.current_index / execution.total_contacts) * 100),
          started_at: execution.started_at,
          completed_at: execution.completed_at
        }
      }
    });

  } catch (error) {
    log('error', `❌ Error fetching broadcast status: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get list of recent broadcast executions
app.get('/api/broadcast/history', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status; // Filter by status if provided

  try {
    let query = supabase
      .from('broadcast_executions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: executions, error } = await query;

    if (error) {
      log('error', `❌ Error fetching broadcast history: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      data: executions || []
    });

  } catch (error) {
    log('error', `❌ Error fetching broadcast history: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// VALUATION REQUESTS API ENDPOINTS
// ============================================

app.get('/api/valuations/list', async (req, res) => {
  const filters = {
    status: req.query.status,
    banker_id: req.query.banker_id,
    date_from: req.query.date_from,
    date_to: req.query.date_to,
    search: req.query.search,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined,
  };
  const result = await valuationAPI.getValuations(filters);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/valuations/:id', async (req, res) => {
  const result = await valuationAPI.getValuation(req.params.id);
  res.status(result.success ? 200 : 404).json(result);
});

app.put('/api/valuations/:id/update', async (req, res) => {
  const result = await valuationAPI.updateValuation(req.params.id, req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.delete('/api/valuations/:id/delete', async (req, res) => {
  const result = await valuationAPI.deleteValuation(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/valuations/statistics/summary', async (req, res) => {
  const filters = {
    date_from: req.query.date_from,
    date_to: req.query.date_to,
  };
  const result = await valuationAPI.getStatistics(filters);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/valuations/export/csv', async (req, res) => {
  const filters = {
    status: req.query.status,
    banker_id: req.query.banker_id,
    date_from: req.query.date_from,
    date_to: req.query.date_to,
    search: req.query.search,
  };
  const result = await valuationAPI.exportToCSV(filters);

  if (result.success) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.csv);
  } else {
    res.status(400).json(result);
  }
});

// ============================================
// BANKER MANAGEMENT API ENDPOINTS
// ============================================

app.get('/api/bankers/list', async (req, res) => {
  const filters = {
    is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    bank_name: req.query.bank_name,
    search: req.query.search,
  };
  const result = await bankerAPI.getBankers(filters);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/bankers/:id', async (req, res) => {
  const result = await bankerAPI.getBanker(req.params.id);
  res.status(result.success ? 200 : 404).json(result);
});

app.post('/api/bankers/create', async (req, res) => {
  const result = await bankerAPI.createBanker(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.put('/api/bankers/:id/update', async (req, res) => {
  const result = await bankerAPI.updateBanker(req.params.id, req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.delete('/api/bankers/:id/delete', async (req, res) => {
  const result = await bankerAPI.deleteBanker(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/bankers/:id/toggle', async (req, res) => {
  const { is_active } = req.body;
  const result = await bankerAPI.toggleActive(req.params.id, is_active);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/bankers/:id/statistics', async (req, res) => {
  const result = await bankerAPI.getBankerStatistics(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/bankers/banks/names', async (req, res) => {
  const result = await bankerAPI.getBankNames();
  res.status(result.success ? 200 : 400).json(result);
});

// Health check endpoint - NON-BLOCKING for Render deployment
app.get('/health', async (_, res) => {
  try {
    // Don't block on client.getState() - check client existence only
    let clientState = 'INITIALIZING';
    if (client) {
      try {
        // Use Promise.race with timeout to avoid blocking
        clientState = await Promise.race([
          client.getState(),
          new Promise((resolve) => setTimeout(() => resolve('INITIALIZING'), 1000))
        ]);
      } catch (err) {
        clientState = 'ERROR';
      }
    } else {
      clientState = 'NO_CLIENT';
    }

    // Quick Supabase check with timeout
    let supabaseStatus = 'UNKNOWN';
    try {
      const supabaseCheck = supabase.from('whatsapp_sessions').select('count(*)', { count: 'exact', head: true });
      const { error } = await Promise.race([
        supabaseCheck,
        new Promise((resolve) => setTimeout(() => resolve({ error: 'TIMEOUT' }), 2000))
      ]);
      supabaseStatus = error ? 'ERROR' : 'CONNECTED';
    } catch (err) {
      supabaseStatus = 'ERROR';
    }

    const mem = process.memoryUsage();

    const health = {
      // Always return healthy if server is running - don't wait for WhatsApp
      status: 'healthy',
      server: 'running',
      version: BOT_VERSION,
      uptime: {
        seconds: Math.floor((Date.now() - startedAt) / 1000),
        readable: formatUptime(Date.now() - startedAt),
      },
      whatsapp: {
        state: clientState,
        ready: clientState === 'CONNECTED',
      },
      supabase: supabaseStatus,
      humanBehavior: humanBehavior.getStatus(),
      system: {
        memory: {
          rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
          heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
        },
        nodejs: process.version,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(health);
  } catch (err) {
    // Even on error, return 200 so Render knows server is alive
    res.status(200).json({
      status: 'healthy',
      server: 'running',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Keep-alive endpoint
app.get('/ping', (_, res) => {
  res.status(200).send('pong');
});

// Check for whatsapp-web.js updates (non-blocking)
async function checkWhatsAppUpdates(currentVersion) {
  try {
    const response = await axios.get('https://registry.npmjs.org/whatsapp-web.js/latest', {
      timeout: 5000
    });
    const latestVersion = response.data.version;

    if (latestVersion !== currentVersion) {
      log('warn', `⚠️ WhatsApp Web.js update available: ${currentVersion} → ${latestVersion}`);
      log('warn', `   Run: npm run check-updates or npm run update-safe`);
    } else {
      log('info', `✅ WhatsApp Web.js is up to date (${currentVersion})`);
    }
  } catch (error) {
    // Silent fail - update check is not critical
    log('debug', `Could not check for whatsapp-web.js updates: ${error.message}`);
  }
}

// Start server
const server = app.listen(PORT, () => {
  // Get whatsapp-web.js version from package.json
  const packageJson = require('./package.json');
  const whatsappVersion = packageJson.dependencies['whatsapp-web.js']?.replace('^', '') || 'unknown';

  log('info', `🚀 Server started on http://localhost:${PORT}`);
  log('info', `📱 Dashboard: http://localhost:${PORT}`);
  log('info', `🤖 Bot Version: ${BOT_VERSION}`);
  log('info', `📦 WhatsApp Web.js Version: ${whatsappVersion}`);
  log('info', `🧠 Human behavior enabled with smart timing and rate limiting`);

  // Check for updates in background (non-blocking)
  checkWhatsAppUpdates(whatsappVersion);

  // In production: delay 10 seconds to let health checks pass first
  // In development: random delay for human-like behavior
  const startDelay = process.env.NODE_ENV === 'production'
    ? 10000  // 10 seconds delay in production
    : humanBehavior.getRandomDelay(3000, 8000);

  log('info', `💻 WhatsApp client will initialize in ${Math.round(startDelay/1000)} seconds...`);
  log('info', '✅ Server is healthy and ready for requests');

  setTimeout(() => {
    log('info', '🔄 Starting WhatsApp client initialization (non-blocking)...');
    startClient();
  }, startDelay);
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  log('info', '📡 New WebSocket client connected');
  wsClients.add(ws);

  // Send initial status
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connected to WhatsApp Bot'
  }));

  // Send current QR code if available
  if (currentQRCode) {
    ws.send(JSON.stringify({ type: 'qr', qr: currentQRCode }));
  }

  ws.on('close', () => {
    log('info', '📡 WebSocket client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    log('error', `WebSocket error: ${error.message}`);
    wsClients.delete(ws);
  });
});

// Enhanced Watchdog with human behavior consideration and randomized timing
const runWatchdog = async () => {
  if (!client) {
    log('warn', '🕵️ Watchdog: client is missing. Restarting...');
    const delay = humanBehavior.getRandomDelay(2000, 8000);
    setTimeout(startClient, delay);
    return;
  }

  try {
    const state = await client.getState();
    log('info', `✅ Watchdog: client state is "${state}".`);

    if (state === 'CONNECTED') {
      // Session is already saved after authentication and ready events
      // Periodic saves are unnecessary and can cause frame detachment during message sends
      log('debug', '✅ Watchdog: Connection healthy, session management handled by events');
    } else {
      log('warn', `⚠️ Watchdog detected bad state "${state}". Restarting client...`);
      await client.destroy();
      client = null;
      const delay = humanBehavior.getRandomDelay(5000, 15000);
      setTimeout(startClient, delay);
    }
  } catch (err) {
    log('error', `🚨 Watchdog error during state check: ${err.message}. Restarting...`);
    client = null;
    const delay = humanBehavior.getRandomDelay(5000, 15000);
    setTimeout(startClient, delay);
  }

  // Schedule next watchdog check with randomized interval (7-10 minutes)
  const nextInterval = (7 + Math.random() * 3) * 60 * 1000;
  setTimeout(runWatchdog, nextInterval);
};

// Start watchdog
setTimeout(runWatchdog, 8 * 60 * 1000);

// Memory monitoring with human-aware timing and randomized intervals
const checkMemoryUsage = () => {
  const mem = process.memoryUsage();
  const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);

  log('info', `🧠 Memory: RSS=${rssMB}MB, HeapUsed=${heapMB}MB, HeapTotal=${heapTotalMB}MB`);

  if (parseFloat(rssMB) > 450) {
    log('error', '🚨 CRITICAL MEMORY USAGE! Force restarting client...');

    if (global.gc) {
      log('warn', 'Forcing garbage collection...');
      global.gc();
    }

    if (client) {
      (async () => {
        try {
          await safelyTriggerSessionSave(client);
          await client.destroy();
          client = null;
          log('warn', 'Client destroyed due to memory pressure');

          // Add human-like delay before restart
          const delay = humanBehavior.getRandomDelay(5000, 15000);
          setTimeout(startClient, delay);
        } catch (err) {
          log('error', `Failed to restart client: ${err.message}`);
        }
      })();
    }
  } else if (parseFloat(rssMB) > 350) {
    log('warn', '⚠️ High memory usage detected');
    if (global.gc) {
      log('info', 'Suggesting garbage collection...');
      global.gc();
    }
  }

  // Schedule next memory check with randomized interval (6-8 minutes)
  const nextInterval = (6 + Math.random() * 2) * 60 * 1000;
  setTimeout(checkMemoryUsage, nextInterval);
};

// Start memory monitoring
setTimeout(checkMemoryUsage, 7 * 60 * 1000);

// Self-ping mechanism with human behavior and randomized intervals
let lastPingSent = 0;
const selfPing = async () => {
  try {
    const now = Date.now();
    if (now - lastPingSent > 6 * 60 * 1000) {
      lastPingSent = now;
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

      // Add random delay before ping
      const delay = humanBehavior.getRandomDelay(0, 2000);
      await humanBehavior.sleep(delay);

      await axios.get(`${appUrl}/ping`, { timeout: 5000 });
      log('debug', '🏓 Self-ping successful');
    }
  } catch (err) {
    log('warn', `Self-ping failed: ${err.message}`);
  }

  // Schedule next self-ping with randomized interval (5-7 minutes)
  const nextInterval = (5 + Math.random() * 2) * 60 * 1000;
  setTimeout(selfPing, nextInterval);
};

app.use((req, res, next) => {
  if (req.path === '/ping') {
    lastPingSent = Date.now();
  }
  next();
});

// Start self-ping
setTimeout(selfPing, 6 * 60 * 1000);

// Helper function to format uptime
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}
