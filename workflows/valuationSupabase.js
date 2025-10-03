const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Valuation Workflow (Supabase Version)
// Processes valuation requests and stores in Supabase instead of Google Sheets
async function valuationWorkflowSupabase(payload, engine) {
  const { groupId, senderId, text, messageId, hasReply, replyInfo, workflowId } = payload;

  console.log('🏡 Starting Valuation Workflow (Supabase)');

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    // Step 1: Extract valuation data from message
    const valuationData = extractValuationData(text, replyInfo);

    // Step 2: Save to Supabase (replaces Google Sheets)
    const { data: savedValuation, error } = await supabase
      .from('valuation_requests')
      .insert({
        group_id: groupId,
        sender_id: senderId,
        message_id: messageId,
        address: valuationData.address,
        property_type: valuationData.propertyType,
        bedrooms: valuationData.bedrooms,
        floor_area: valuationData.floorArea,
        asking_price: valuationData.askingPrice,
        raw_message: text,
        reply_message: replyInfo?.text || null,
        workflow_id: workflowId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save valuation: ${error.message}`);
    }

    console.log(`✅ Valuation saved to Supabase with ID: ${savedValuation.id}`);

    // Step 3: Process and send response (if configured)
    const responseMessage = await generateValuationResponse(valuationData);

    if (responseMessage) {
      await sendWhatsAppMessage({
        groupId,
        message: responseMessage
      });

      // Update status to 'replied'
      await supabase
        .from('valuation_requests')
        .update({ status: 'replied' })
        .eq('id', savedValuation.id);

      console.log('✅ Valuation response sent and status updated');
    } else {
      // Update status to 'processed'
      await supabase
        .from('valuation_requests')
        .update({ status: 'processed' })
        .eq('id', savedValuation.id);
    }

    return {
      success: true,
      message: 'Valuation request processed',
      valuationId: savedValuation.id
    };

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
    data.askingPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
  }

  return data;
}

// Generate response message (placeholder)
async function generateValuationResponse(data) {
  if (!data.address) {
    return null;
  }

  // Build detailed response if data is available
  let response = `✅ Valuation request received!\n\n📍 Address: ${data.address}`;

  if (data.propertyType) {
    response += `\n🏠 Type: ${data.propertyType}`;
  }

  if (data.bedrooms) {
    response += `\n🛏️ Bedrooms: ${data.bedrooms}`;
  }

  if (data.floorArea) {
    response += `\n📐 Floor Area: ${data.floorArea} sqft`;
  }

  if (data.askingPrice) {
    response += `\n💰 Asking Price: $${data.askingPrice.toLocaleString()}`;
  }

  response += `\n\n⏳ Our team will process this request and get back to you shortly.`;

  return response;
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

module.exports = valuationWorkflowSupabase;
