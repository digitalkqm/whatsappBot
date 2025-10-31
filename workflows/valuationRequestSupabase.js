/**
 * Valuation Request Workflow - Supabase Version
 *
 * Triggered when "Valuation Request:" template is detected in WhatsApp group
 *
 * Flow:
 * 1. Parse template (6 fields)
 * 2. Route to banker based on "Banker Name"
 * 3. Save to Supabase
 * 4. Forward to banker (ONLY 3 fields: Address, Size, Asking)
 * 5. Send acknowledgment to requester group
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse "Valuation Request:" template
 *
 * Template format:
 * Valuation Request:
 *
 * Address: [value]
 * Size: [value]
 * Asking: [value]
 * Salesperson Name: [value]
 * Agent Number: [value]
 * Banker Name: [value]
 */
function parseValuationTemplate(text) {
  if (!text.toLowerCase().includes('valuation request:')) {
    return null;
  }

  const data = {};

  // Split into lines and filter out empty lines
  const nonEmpty = text.split('\n').filter(line => line.trim() !== '');

  // Find specific lines
  const addressLine = nonEmpty.find(line => line.toLowerCase().includes('address'));
  const sizeLine = nonEmpty.find(line => line.toLowerCase().includes('size'));
  const askingLine = nonEmpty.find(line => line.toLowerCase().includes('asking'));
  const salespersonLine = nonEmpty.find(line => line.toLowerCase().includes('salesperson'));
  const agentNumberLine = nonEmpty.find(line => line.toLowerCase().includes('agent number'));
  const bankerLine = nonEmpty.find(line => line.toLowerCase().includes('banker'));

  // Extract values
  if (addressLine) data.address = addressLine.split(':')[1]?.trim() || null;
  if (sizeLine) data.size = sizeLine.split(':')[1]?.trim() || null;
  if (askingLine) data.asking = askingLine.split(':')[1]?.trim() || null;
  if (salespersonLine) data.salesperson_name = salespersonLine.split(':')[1]?.trim() || null;
  if (bankerLine) data.banker_name_requested = bankerLine.split(':')[1]?.trim() || null;

  // Extract and format agent number
  if (agentNumberLine) {
    const agentPart = agentNumberLine.split(':')[1]?.trim() || '';

    // Remove any non-digit characters except leading +
    let number = agentPart.replace(/[^\d+]/g, '');

    // If number starts with +, remove it
    if (number.startsWith('+')) {
      number = number.substring(1);
    }

    // If number doesn't start with 65, add 65 prefix (Singapore)
    if (number && !number.startsWith('65')) {
      number = '65' + number;
    }

    data.agent_number = number || null;
    data.agent_whatsapp_id = number ? `${number}@c.us` : null;
  }

  return data;
}

/**
 * Validate parsed template data
 * Returns { valid: boolean, missingFields: array }
 */
function validateValuationData(data) {
  const missingFields = [];

  // Check all required fields
  if (!data.address || data.address.includes('[') || data.address.toLowerCase().includes('property address')) {
    missingFields.push('Address');
  }
  if (!data.size || data.size.includes('[') || data.size.toLowerCase().includes('property size')) {
    missingFields.push('Size');
  }
  if (!data.asking || data.asking.includes('[') || data.asking.toLowerCase().includes('asking price')) {
    missingFields.push('Asking');
  }
  if (!data.salesperson_name || data.salesperson_name.includes('[') || data.salesperson_name.toLowerCase().includes('agent/salesperson')) {
    missingFields.push('Salesperson Name');
  }
  // Agent number is optional - removed from required validation
  if (!data.banker_name_requested || data.banker_name_requested.includes('[') || data.banker_name_requested.toLowerCase().includes('banker name')) {
    missingFields.push('Banker Name');
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Format validation error message
 */
function formatValidationError(missingFields) {
  return `❌ Valuation Request Incomplete

Missing or invalid fields:
${missingFields.map(field => `• ${field}`).join('\n')}

Please use the complete template:

Valuation Request:

Address: [property address]
Size: [property size in sqft]
Asking: [asking price]
Salesperson Name: [agent/salesperson name]
Agent Number: [phone number] (optional)
Banker Name: [banker name]

Required fields must have actual values (not placeholders). Agent Number is optional.`;
}

/**
 * Route message to banker based on banker_name_requested
 * Uses EXACT keyword matching (case-insensitive)
 */
async function routeToBanker(bankerNameRequested) {
  const lowerName = bankerNameRequested.toLowerCase().trim();

  console.log(`🔍 Routing banker request: "${bankerNameRequested}" (lowercase: "${lowerName}")`);

  // Find banker by routing keywords (ordered by creation date only)
  const { data: bankers, error } = await supabase
    .from('bankers')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching bankers:', error);
    return null;
  }

  if (!bankers || bankers.length === 0) {
    console.error('❌ No active bankers found in database');
    return null;
  }

  console.log(`📊 Found ${bankers.length} active banker(s):`);
  bankers.forEach((b, idx) => {
    const keyword = (b.routing_keywords && b.routing_keywords.length > 0) ? b.routing_keywords[0] : 'none';
    console.log(`   ${idx + 1}. ${b.name} (${b.bank_name}) - Keyword: "${keyword}"`);
  });

  // Find matching banker using EXACT keyword match
  for (const banker of bankers) {
    const keywords = banker.routing_keywords || [];

    // Use only the first keyword for matching
    if (keywords.length > 0) {
      const keyword = keywords[0].toLowerCase().trim();

      if (lowerName === keyword) {
        console.log(`✅ Exact match found! "${lowerName}" matches keyword "${keyword}" → Routing to: ${banker.name} (${banker.bank_name})`);
        return banker;
      }
    }
  }

  // No match found - return null to indicate error
  console.error(`❌ No exact keyword match found for "${bankerNameRequested}"`);
  console.error(`💡 Tip: Add exact routing keyword "${bankerNameRequested}" to a banker in database`);

  return null;
}

/**
 * Format message to banker (ONLY 3 fields)
 */
function formatBankerMessage(address, size, asking) {
  return `Valuation Request:

Address: ${address}
Size: ${size}
Asking: ${asking}`;
}

/**
 * Format acknowledgment to requester
 */
function formatAcknowledgment(bankerName) {
  return `Thanks! We've forwarded your request to ${bankerName}.
We'll let you know when they replied.`;
}

/**
 * Main workflow handler
 */
async function valuationRequestWorkflow(payload, engine) {
  const { message, groupId, senderId, messageId } = payload;
  const text = message.body || '';

  console.log('🔍 Valuation Request Workflow - Checking message:', text);

  // Parse template
  const parsed = parseValuationTemplate(text);
  if (!parsed) {
    console.log('❌ Not a valuation request template');
    return;
  }

  console.log('✅ Parsed valuation request:', parsed);

  // Validate parsed data
  const validation = validateValuationData(parsed);
  if (!validation.valid) {
    console.log('❌ Validation failed. Missing fields:', validation.missingFields);
    const errorMessage = formatValidationError(validation.missingFields);
    await message.reply(errorMessage);
    return;
  }

  console.log('✅ Validation passed - all required fields present');

  // Route to banker
  const banker = await routeToBanker(parsed.banker_name_requested);
  if (!banker) {
    console.error('❌ No banker found for:', parsed.banker_name_requested);
    await message.reply('❌ Could not find banker. Please check banker name and try again.');
    return;
  }

  console.log('✅ Routed to banker:', banker.name, banker.bank_name);

  // Save to Supabase
  const { data: savedValuation, error: saveError } = await supabase
    .from('valuation_requests')
    .insert({
      // Original request tracking
      group_id: groupId,
      sender_id: senderId,
      message_id: messageId,
      requester_group_id: groupId,
      request_message_id: messageId,
      raw_message: text,

      // Template fields
      address: parsed.address,
      size: parsed.size,
      asking: parsed.asking,
      salesperson_name: parsed.salesperson_name,
      agent_number: parsed.agent_number,
      agent_whatsapp_id: parsed.agent_whatsapp_id,
      banker_name_requested: parsed.banker_name_requested,

      // Banker assignment
      banker_id: banker.id,
      banker_name: banker.name,
      banker_agent_number: banker.agent_number,
      target_group_id: banker.whatsapp_group_id,

      // Status
      status: 'pending'
    })
    .select()
    .single();

  if (saveError) {
    console.error('❌ Error saving to Supabase:', saveError);
    await message.reply('❌ Failed to save request. Please try again.');
    return;
  }

  console.log('✅ Saved to Supabase:', savedValuation.id);

  // Forward to banker group (ONLY 3 fields)
  const bankerMessage = formatBankerMessage(parsed.address, parsed.size, parsed.asking);

  try {
    const bankerChat = await engine.client.getChatById(banker.whatsapp_group_id);
    const sentMessage = await bankerChat.sendMessage(bankerMessage);

    console.log('✅ Forwarded to banker group:', banker.whatsapp_group_id);
    console.log('✅ Forward message ID:', sentMessage.id._serialized);

    // Update with forward tracking (keep status as 'pending' until banker replies)
    const { error: updateError } = await supabase
      .from('valuation_requests')
      .update({
        forwarded_to_banker: true,
        forward_message_id: sentMessage.id._serialized,
        forwarded_at: new Date().toISOString()
        // Note: status remains 'pending' until banker replies
      })
      .eq('id', savedValuation.id);

    if (updateError) {
      console.error('❌ Error updating forward tracking:', updateError);
      await message.reply('❌ Request sent but failed to update tracking. Please contact support.');
      return;
    }

    console.log('✅ Updated forward tracking');

  } catch (forwardError) {
    console.error('❌ Error forwarding to banker:', forwardError);
    await message.reply('❌ Failed to forward to banker. Please try again.');
    return;
  }

  // Send acknowledgment to requester
  const ackMessage = formatAcknowledgment(banker.name);

  try {
    await message.reply(ackMessage);
    console.log('✅ Sent acknowledgment to requester');

    // Update acknowledgment tracking
    await supabase
      .from('valuation_requests')
      .update({
        acknowledgment_sent: true
      })
      .eq('id', savedValuation.id);

  } catch (ackError) {
    console.error('❌ Error sending acknowledgment:', ackError);
  }

  console.log('✅ Valuation request workflow complete');
}

module.exports = { valuationRequestWorkflow };
