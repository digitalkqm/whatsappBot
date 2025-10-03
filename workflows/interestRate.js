const { google } = require('googleapis');
const axios = require('axios');

// Interest Rate Workflow
// Replicates the n8n workflow for sending interest rate updates to contacts
async function interestRateWorkflow(payload, engine) {
  const { text, groupId } = payload;

  console.log('📊 Starting Interest Rate Workflow');

  // Step 1: Initialize Google Sheets API
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.INTEREST_RATE_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('INTEREST_RATE_SPREADSHEET_ID not configured');
  }

  try {
    // Step 2: Reset index to 0 (start from beginning)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Clients!E2',
      valueInputOption: 'RAW',
      resource: {
        values: [[0]]
      }
    });

    // Step 3: Update message content
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Clients!F2',
      valueInputOption: 'RAW',
      resource: {
        values: [[text]]
      }
    });

    console.log('✅ Message content updated in Google Sheets');

    // Step 4: Start processing contacts in batches
    await processContactBatches(sheets, spreadsheetId, groupId, engine);

    return { success: true, message: 'Interest rate updates sent to all contacts' };

  } catch (error) {
    console.error('❌ Interest Rate Workflow Error:', error);

    // Send error notification to group
    if (groupId) {
      await notifyError(groupId, `Interest rate workflow failed: ${error.message}`);
    }

    throw error;
  }
}

// Process contacts in batches of 10
async function processContactBatches(sheets, spreadsheetId, groupId, engine) {
  let hasMoreContacts = true;
  let iteration = 0;

  while (hasMoreContacts) {
    iteration++;
    console.log(`📦 Processing batch #${iteration}`);

    try {
      // Read current index and message
      const indexResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Clients!E2:F2'
      });

      const lastIndex = parseInt(indexResponse.data.values?.[0]?.[0] || 0);
      const messageContent = indexResponse.data.values?.[0]?.[1] || '';

      // Read image URL
      const imgResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Clients!H2'
      });

      const imgURL = imgResponse.data.values?.[0]?.[0] || '';

      // Read all contacts
      const contactsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Clients!A2:B400'
      });

      const contacts = contactsResponse.data.values || [];

      // Slice next 10 contacts
      const batch = contacts.slice(lastIndex, lastIndex + 10);

      if (batch.length === 0) {
        console.log('✅ All contacts processed');
        hasMoreContacts = false;
        break;
      }

      // Send messages to batch
      for (let i = 0; i < batch.length; i++) {
        const [name, phone] = batch[i];
        const currentIndex = lastIndex + i + 1;

        try {
          console.log(`📤 Sending to: ${name} (${phone})`);

          await sendWhatsAppMessage({
            jid: `${phone}@c.us`,
            message: `Dear ${name}\n\n${messageContent}`,
            imageUrl: imgURL
          });

          // Wait 7 seconds between messages (human-like behavior)
          await engine.sleep(7000);

        } catch (sendError) {
          console.error(`❌ Failed to send to ${name}:`, sendError.message);

          // Notify about failure and stop
          await notifyError(groupId, `Broadcast stopped at: ${name}, ${phone}`);
          throw sendError;
        }
      }

      // Update last index
      const newIndex = lastIndex + batch.length;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Clients!E2',
        valueInputOption: 'RAW',
        resource: {
          values: [[newIndex]]
        }
      });

      console.log(`✅ Updated index to ${newIndex}`);

      // Check if there are more contacts
      if (newIndex >= contacts.length) {
        console.log('✅ Reached end of contact list');
        hasMoreContacts = false;
      } else {
        // Wait 10 minutes before next batch
        console.log('⏳ Waiting 10 minutes before next batch...');
        await engine.sleep(10 * 60 * 1000);
      }

    } catch (batchError) {
      console.error('❌ Batch processing error:', batchError);
      throw batchError;
    }
  }
}

// Send WhatsApp message via bot API
async function sendWhatsAppMessage({ jid, message, imageUrl }) {
  const botUrl = process.env.APP_URL || 'http://localhost:3000';

  const payload = {
    jid,
    message
  };

  if (imageUrl) {
    payload.imageUrl = imageUrl;
  }

  const response = await axios.post(`${botUrl}/send-message`, payload, {
    timeout: 30000
  });

  return response.data;
}

// Notify error to group
async function notifyError(groupId, errorMessage) {
  try {
    const botUrl = process.env.APP_URL || 'http://localhost:3000';

    await axios.post(`${botUrl}/send-message`, {
      groupId,
      message: `⚠️ ${errorMessage}`
    }, {
      timeout: 10000
    });
  } catch (err) {
    console.error('Failed to send error notification:', err.message);
  }
}

module.exports = interestRateWorkflow;
