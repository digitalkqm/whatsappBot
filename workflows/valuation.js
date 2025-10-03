const { google } = require('googleapis');
const axios = require('axios');

// Valuation Workflow
// Processes valuation requests from WhatsApp groups
async function valuationWorkflow(payload, engine) {
  const { groupId, senderId, text, messageId, hasReply, replyInfo } = payload;

  console.log('🏡 Starting Valuation Workflow');

  // Step 1: Initialize Google Sheets API
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.VALUATION_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('VALUATION_SPREADSHEET_ID not configured');
  }

  try {
    // Step 2: Extract valuation data from message
    const valuationData = extractValuationData(text, replyInfo);

    // Step 3: Save to Google Sheets
    await saveValuationToSheet(sheets, spreadsheetId, {
      ...valuationData,
      groupId,
      senderId,
      messageId,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Valuation data saved to Google Sheets');

    // Step 4: Process and send response (if configured)
    const responseMessage = await generateValuationResponse(valuationData);

    if (responseMessage) {
      await sendWhatsAppMessage({
        groupId,
        message: responseMessage
      });

      console.log('✅ Valuation response sent');
    }

    return { success: true, message: 'Valuation request processed' };

  } catch (error) {
    console.error('❌ Valuation Workflow Error:', error);

    // Send error notification to group
    if (groupId) {
      await notifyError(groupId, `Valuation processing failed: ${error.message}`);
    }

    throw error;
  }
}

// Extract valuation data from message
function extractValuationData(text, replyInfo) {
  const data = {
    rawMessage: text,
    replyMessage: replyInfo?.text || null
  };

  // Parse address (basic pattern matching)
  const addressMatch = text.match(/(?:address|location|property)[:\s]+(.+?)(?:\n|$)/i);
  if (addressMatch) {
    data.address = addressMatch[1].trim();
  }

  // Parse property type
  const typeMatch = text.match(/(?:type|property type)[:\s]+(HDB|Condo|Landed|Apartment)/i);
  if (typeMatch) {
    data.propertyType = typeMatch[1];
  }

  // Parse bedrooms
  const bedroomMatch = text.match(/(\d+)\s*(?:bed|bedroom|br)/i);
  if (bedroomMatch) {
    data.bedrooms = parseInt(bedroomMatch[1]);
  }

  // Parse floor area
  const areaMatch = text.match(/(\d+)\s*(?:sqft|sq ft|square feet)/i);
  if (areaMatch) {
    data.floorArea = parseInt(areaMatch[1]);
  }

  // Parse asking price (if mentioned)
  const priceMatch = text.match(/(?:price|asking)[:\s]+\$?([\d,]+)/i);
  if (priceMatch) {
    data.askingPrice = priceMatch[1].replace(/,/g, '');
  }

  return data;
}

// Save valuation to Google Sheets
async function saveValuationToSheet(sheets, spreadsheetId, data) {
  // Append to next available row
  const values = [[
    data.timestamp,
    data.groupId,
    data.senderId,
    data.messageId,
    data.address || '',
    data.propertyType || '',
    data.bedrooms || '',
    data.floorArea || '',
    data.askingPrice || '',
    data.rawMessage,
    data.replyMessage || ''
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Valuations!A:K',
    valueInputOption: 'RAW',
    resource: { values }
  });
}

// Generate response message (placeholder)
async function generateValuationResponse(data) {
  if (!data.address) {
    return null;
  }

  // Simple acknowledgment response
  return `✅ Valuation request received for:\n📍 ${data.address}\n\nOur team will process this and get back to you shortly.`;
}

// Send WhatsApp message via bot API
async function sendWhatsAppMessage({ groupId, jid, message, imageUrl }) {
  const botUrl = process.env.APP_URL || 'http://localhost:3000';

  const payload = {
    message
  };

  if (groupId) {
    payload.groupId = groupId;
  } else if (jid) {
    payload.jid = jid;
  }

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

module.exports = valuationWorkflow;
