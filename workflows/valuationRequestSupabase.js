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
 * Route message to banker based on banker_name_requested
 */
async function routeToBanker(bankerNameRequested) {
  const lowerName = bankerNameRequested.toLowerCase();

  // Find banker by routing keywords (highest priority first)
  const { data: bankers, error } = await supabase
    .from('bankers')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching bankers:', error);
    return null;
  }

  // Find matching banker
  for (const banker of bankers) {
    const keywords = banker.routing_keywords || [];
    if (keywords.some(keyword => lowerName.includes(keyword.toLowerCase()))) {
      return banker;
    }
  }

  // Fallback: return first active banker
  return bankers.length > 0 ? bankers[0] : null;
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

    // Update with forward tracking
    await supabase
      .from('valuation_requests')
      .update({
        forwarded_to_banker: true,
        forward_message_id: sentMessage.id._serialized,
        forwarded_at: new Date().toISOString(),
        status: 'forwarded'
      })
      .eq('id', savedValuation.id);

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
