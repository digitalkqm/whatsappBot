const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Interest Rate Workflow (Supabase Version)
// Sends interest rate updates to contacts stored in Supabase instead of Google Sheets
async function interestRateWorkflowSupabase(payload, engine) {
  const { text, groupId, workflowId } = payload;

  console.log('📊 Starting Interest Rate Workflow (Supabase)');

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Get contact list ID from environment or workflow config
  const contactListId = process.env.INTEREST_RATE_CONTACT_LIST_ID;

  if (!contactListId) {
    throw new Error('INTEREST_RATE_CONTACT_LIST_ID not configured');
  }

  try {
    // Step 1: Load contacts from Supabase
    console.log(`Loading contacts from list: ${contactListId}`);
    const { data: contacts, error: contactsError } = await supabase
      .from('broadcast_contacts')
      .select('id, name, phone, tier, is_active')
      .eq('list_id', contactListId)
      .eq('is_active', true)
      .order('tier', { ascending: false }) // VIP first
      .order('name', { ascending: true });

    if (contactsError) {
      throw new Error(`Failed to load contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      throw new Error('No active contacts found in the list');
    }

    console.log(`Found ${contacts.length} active contacts`);

    // Step 2: Get image URL from workflow config or environment
    const imageUrl = process.env.INTEREST_RATE_IMAGE_URL || null;

    // Step 3: Create broadcast execution record
    const totalBatches = Math.ceil(contacts.length / 10);
    const { data: execution, error: execError } = await supabase
      .from('broadcast_executions')
      .insert({
        workflow_id: workflowId,
        message_content: text,
        image_url: imageUrl,
        contact_list_id: contactListId,
        total_contacts: contacts.length,
        current_index: 0,
        sent_count: 0,
        failed_count: 0,
        current_batch: 1,
        total_batches: totalBatches,
        batch_size: 10,
        delay_between_messages: 7000,
        delay_between_batches: 600000,
        status: 'running'
      })
      .select()
      .single();

    if (execError) {
      throw new Error(`Failed to create execution: ${execError.message}`);
    }

    const executionId = execution.id;
    console.log(`Created execution record: ${executionId}`);

    // Step 4: Process contacts in batches
    await processContactBatches(
      supabase,
      executionId,
      contacts,
      text,
      imageUrl,
      groupId,
      engine
    );

    // Step 5: Mark execution as completed
    await supabase
      .from('broadcast_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', executionId);

    return {
      success: true,
      message: 'Interest rate updates sent to all contacts',
      executionId
    };

  } catch (error) {
    console.error('❌ Interest Rate Workflow Error:', error);

    // Send error notification to group
    if (groupId) {
      await notifyError(groupId, `Interest rate workflow failed: ${error.message}`);
    }

    throw error;
  }
}

// Process contacts in batches
async function processContactBatches(supabase, executionId, contacts, messageContent, imageUrl, groupId, engine) {
  const batchSize = 10;
  const totalBatches = Math.ceil(contacts.length / batchSize);

  for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
    console.log(`📦 Processing batch ${batchNum}/${totalBatches}`);

    const startIdx = (batchNum - 1) * batchSize;
    const endIdx = Math.min(startIdx + batchSize, contacts.length);
    const batch = contacts.slice(startIdx, endIdx);

    let batchSent = 0;
    let batchFailed = 0;

    // Send messages to batch
    for (let i = 0; i < batch.length; i++) {
      const contact = batch[i];

      try {
        console.log(`📤 Sending to: ${contact.name} (${contact.phone})`);

        // Personalize message
        const personalizedMessage = `Dear ${contact.name}\n\n${messageContent}`;

        // Send WhatsApp message
        const result = await sendWhatsAppMessage({
          jid: `${contact.phone}@c.us`,
          message: personalizedMessage,
          imageUrl
        });

        // Record successful send
        await supabase
          .from('broadcast_messages')
          .insert({
            execution_id: executionId,
            contact_id: contact.id,
            recipient_name: contact.name,
            recipient_phone: contact.phone,
            personalized_message: personalizedMessage,
            image_url: imageUrl,
            status: 'sent',
            whatsapp_message_id: result.messageId,
            sent_at: new Date().toISOString()
          });

        // Update contact's last_contacted_at
        await supabase
          .from('broadcast_contacts')
          .update({ last_contacted_at: new Date().toISOString() })
          .eq('id', contact.id);

        batchSent++;

        // Wait 7 seconds between messages (human-like behavior)
        await engine.sleep(7000);

      } catch (sendError) {
        console.error(`❌ Failed to send to ${contact.name}:`, sendError.message);

        // Record failed send
        await supabase
          .from('broadcast_messages')
          .insert({
            execution_id: executionId,
            contact_id: contact.id,
            recipient_name: contact.name,
            recipient_phone: contact.phone,
            personalized_message: `Dear ${contact.name}\n\n${messageContent}`,
            status: 'failed',
            error_message: sendError.message,
            failed_at: new Date().toISOString()
          });

        batchFailed++;

        // Notify about failure and stop
        await notifyError(groupId, `Broadcast stopped at: ${contact.name}, ${contact.phone}`);
        throw sendError;
      }
    }

    // Update execution progress
    const totalSent = startIdx + batchSent;
    const totalFailed = (startIdx - (batchNum - 1) * batchSize) + batchFailed;

    await supabase
      .from('broadcast_executions')
      .update({
        current_batch: batchNum,
        current_index: totalSent + totalFailed,
        sent_count: totalSent,
        failed_count: totalFailed,
        last_sent_at: new Date().toISOString()
      })
      .eq('id', executionId);

    console.log(`✅ Batch ${batchNum} complete: ${batchSent} sent, ${batchFailed} failed`);

    // Check if there are more batches
    if (batchNum < totalBatches) {
      // Wait 10 minutes before next batch
      console.log('⏳ Waiting 10 minutes before next batch...');
      const nextBatchAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase
        .from('broadcast_executions')
        .update({ next_batch_at: nextBatchAt })
        .eq('id', executionId);

      await engine.sleep(10 * 60 * 1000);
    }
  }

  console.log('✅ All batches processed');
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

module.exports = interestRateWorkflowSupabase;
