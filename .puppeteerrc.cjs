const { join } = require('path');

/**
 * Puppeteer configuration for WhatsApp Web.js bot
 * This ensures Chromium is properly installed and located
 */
module.exports = {
  // Use Puppeteer's cache directory for Chromium
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
