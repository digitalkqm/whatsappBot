/**
 * Valuation Reply Workflow - Supabase Version
 *
 * Triggered when banker replies to forwarded valuation request in banker's group
 *
 * Flow:
 * 1. Detect banker reply (quoted message in banker's group)
 * 2. Find original valuation via forward_message_id
 * 3. Format reply message (2 versions)
 * 4. Send to requester group (with "From Banker" header)
 * 5. Send to agent private chat (clean format, no header)
 * 6. Update database
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Format reply to requester group (with "From Banker" header)
 */
function formatRequesterReply(address, size, asking, bankName, bankerName, bankerReply) {
  return `From Banker: ${bankName} - ${bankerName}

Address: ${address}
Size: ${size}
Asking: ${asking}
Valuation: ${bankerReply}`;
}

/**
 * Format notification to agent (clean format, no header)
 */
function formatAgentNotification(address, size, asking, bankerReply) {
  return `Address: ${address}
Size: ${size}
Asking: ${asking}
Valuation: ${bankerReply}`;
}

/**
 * Main workflow handler
 */
async function valuationReplyWorkflow(payload, engine) {
  const { message, groupId, senderId, messageId } = payload;
  const text = message.body || '';

  console.log('🔍 Valuation Reply Workflow - Checking message from group:', groupId);

  // Check if message has a quoted reply
  if (!message.hasQuotedMsg) {
    console.log('❌ No quoted message, skipping');
    return;
  }

  // Get quoted message
  let quotedMsg;
  try {
    quotedMsg = await message.getQuotedMessage();
  } catch (error) {
    console.error('❌ Error getting quoted message:', error);
    return;
  }

  const quotedMessageId = quotedMsg.id._serialized;
  console.log('✅ Quoted message ID:', quotedMessageId);

  // Find original valuation via forward_message_id
  const { data: valuation, error: fetchError } = await supabase
    .from('valuation_requests')
    .select('*')
    .eq('forward_message_id', quotedMessageId)
    .eq('target_group_id', groupId)
    .single();

  if (fetchError || !valuation) {
    console.log('❌ No matching valuation found for forward_message_id:', quotedMessageId);
    console.log('❌ Query error:', fetchError);
    console.log('🔍 Searching with group ID:', groupId);

    // Debug: Check if there are any valuations for this group
    const { data: allValuations, error: debugError } = await supabase
      .from('valuation_requests')
      .select('id, forward_message_id, target_group_id, status')
      .eq('target_group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('🔍 Recent valuations for this group:', allValuations);

    return;
  }

  console.log('✅ Found original valuation:', valuation.id);

  // Get banker info for "From Banker" header
  const { data: banker } = await supabase
    .from('bankers')
    .select('*')
    .eq('id', valuation.banker_id)
    .single();

  // Update database with banker reply (status remains 'pending', tracked via timestamps)
  const { error: updateError } = await supabase
    .from('valuation_requests')
    .update({
      banker_reply_message_id: messageId,
      banker_reply_text: text,
      banker_replied_at: new Date().toISOString()
      // Note: status remains 'pending', state tracked via banker_replied_at timestamp
    })
    .eq('id', valuation.id);

  if (updateError) {
    console.error('❌ Error updating valuation:', updateError);
    return;
  }

  console.log('✅ Updated valuation with banker reply');

  // Format reply messages
  const requesterMessage = formatRequesterReply(
    valuation.address,
    valuation.size,
    valuation.asking,
    banker?.bank_name || 'Unknown Bank',
    banker?.name || 'Unknown Banker',
    text
  );

  const agentMessage = formatAgentNotification(
    valuation.address,
    valuation.size,
    valuation.asking,
    text
  );

  // Send to requester group
  let finalReplyMessageId = null;
  try {
    const requesterChat = await engine.client.getChatById(valuation.requester_group_id);
    const sentMessage = await requesterChat.sendMessage(requesterMessage);
    finalReplyMessageId = sentMessage.id._serialized;

    console.log('✅ Sent reply to requester group:', valuation.requester_group_id);
    console.log('✅ Final reply message ID:', finalReplyMessageId);

  } catch (requesterError) {
    console.error('❌ Error sending to requester group:', requesterError);
  }

  // Send to agent private chat
  let agentNotificationMessageId = null;
  if (valuation.agent_whatsapp_id) {
    try {
      const agentChat = await engine.client.getChatById(valuation.agent_whatsapp_id);
      const sentMessage = await agentChat.sendMessage(agentMessage);
      agentNotificationMessageId = sentMessage.id._serialized;

      console.log('✅ Sent notification to agent:', valuation.agent_whatsapp_id);
      console.log('✅ Agent notification message ID:', agentNotificationMessageId);

    } catch (agentError) {
      console.error('❌ Error sending to agent:', agentError);
    }
  } else {
    console.log('⚠️ No agent WhatsApp ID, skipping agent notification');
  }

  // Update database with final tracking (status remains 'pending', tracked via completed_at)
  await supabase
    .from('valuation_requests')
    .update({
      final_reply_sent: finalReplyMessageId ? true : false,
      final_reply_message_id: finalReplyMessageId,
      agent_notified: agentNotificationMessageId ? true : false,
      agent_notification_message_id: agentNotificationMessageId,
      completed_at: new Date().toISOString()
      // Note: status remains 'pending', workflow completion tracked via completed_at timestamp
    })
    .eq('id', valuation.id);

  console.log('✅ Valuation reply workflow complete');
}

module.exports = { valuationReplyWorkflow };
