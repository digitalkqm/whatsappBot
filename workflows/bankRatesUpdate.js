const axios = require('axios');

/**
 * Bank Rates Update Workflow
 *
 * Triggers n8n webhook when bank rates update is detected.
 * Simple webhook trigger - no complex processing needed.
 *
 * @param {Object} payload - Message payload from bot
 * @param {Object} engine - Workflow engine instance
 */
async function bankRatesUpdateWorkflow(payload, engine) {
  const { groupId, message } = payload;
  const text = message?.body || '';

  console.log('🏦 Starting Bank Rates Update Workflow');
  console.log(`📝 Message detected: ${text.substring(0, 100)}...`);

  try {
    // Call n8n webhook for bank rates update
    const n8nWebhookUrl =
      process.env.BANK_RATES_WEBHOOK_URL ||
      'https://kamdigital.app.n8n.cloud/webhook/bankRatesUpdate';

    console.log(`🔄 Calling n8n webhook: ${n8nWebhookUrl}`);

    const response = await axios.post(
      n8nWebhookUrl,
      {
        body: {
          text: text,
          groupId: groupId,
          timestamp: new Date().toISOString()
        }
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Bank rates update sent to n8n successfully');
    console.log(`📊 n8n response status: ${response.status}`);

    // Send confirmation back to WhatsApp group
    if (groupId) {
      await notifyGroup(
        groupId,
        '✅ Bank rates update received and forwarded to n8n for processing.'
      );
    }

    return {
      success: true,
      message: 'Bank rates update processed',
      n8nResponse: response.data
    };
  } catch (error) {
    console.error('❌ Bank Rates Update Workflow Error:', error.message);

    // Send error notification to group
    if (groupId) {
      await notifyGroup(
        groupId,
        `⚠️ Failed to process bank rates update: ${error.message}\n\nPlease try again or contact support.`
      );
    }

    throw error;
  }
}

/**
 * Helper function to send notification to WhatsApp group
 * @param {string} groupId - WhatsApp group ID
 * @param {string} message - Message to send
 */
async function notifyGroup(groupId, message) {
  const botUrl = process.env.APP_URL || 'http://localhost:3000';

  try {
    await axios.post(
      `${botUrl}/send-message`,
      {
        groupId,
        message,
        priority: 'normal'
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`📤 Notification sent to group: ${groupId}`);
  } catch (err) {
    console.error('Failed to send notification:', err.message);
    // Don't throw - notification failure shouldn't break the workflow
  }
}

module.exports = bankRatesUpdateWorkflow;
