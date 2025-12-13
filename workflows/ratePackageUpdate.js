const axios = require('axios');

/**
 * Rate Package Update Workflow
 *
 * Triggers n8n webhook to process and store bank rate packages in Supabase.
 * The n8n workflow handles AI parsing, data transformation, and database storage.
 *
 * @param {Object} payload - Message payload from bot
 * @param {Object} engine - Workflow engine instance
 */
async function ratePackageUpdateWorkflow(payload, engine) {
  const { groupId, message } = payload;
  const text = message?.body || '';

  console.log('📦 Starting Rate Package Update Workflow');
  console.log(`📝 Message text: ${text.substring(0, 100)}...`);

  try {
    // Call n8n webhook
    const n8nWebhookUrl = 'https://kamdigital.app.n8n.cloud/webhook/updatePackage';

    console.log(`🔄 Calling n8n webhook: ${n8nWebhookUrl}`);

    const response = await axios.post(
      n8nWebhookUrl,
      {
        body: {
          text: text
        }
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Rate package update sent to n8n successfully');
    console.log(`📊 n8n response status: ${response.status}`);

    // Send confirmation back to WhatsApp group
    if (groupId) {
      await notifyGroup(
        groupId,
        '✅ Rate package update received and processing...\n\nThe n8n workflow will parse and store the data in Supabase.'
      );
    }

    return {
      success: true,
      message: 'Rate package update processed',
      n8nResponse: response.data
    };
  } catch (error) {
    console.error('❌ Rate Package Update Workflow Error:', error.message);

    // Send error notification to group
    if (groupId) {
      await notifyGroup(
        groupId,
        `⚠️ Failed to process rate package update: ${error.message}\n\nPlease check the message format and try again.`
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
        priority: 'normal' // Normal priority for workflow notifications
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

module.exports = ratePackageUpdateWorkflow;
