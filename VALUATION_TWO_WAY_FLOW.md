# 🔄 Valuation Workflow - COMPLETE Two-Way Communication

## ❌ What I Missed

You're **absolutely correct**! The valuation workflow is **TWO-WAY COMMUNICATION**:

1. ✅ **Request Flow**: Requester → System → Banker (I documented this)
2. ❌ **Reply Flow**: Banker → System → Requester (**I MISSED THIS!**)

---

## 🔄 Complete Two-Way Flow

### **FLOW 1: Request (Requester → Banker)** ✅

```
┌─────────────────────────────────────────────────────────────┐
│ 1. REQUESTER'S GROUP                                        │
│    Group: "Keyquest Mortgage Team" (120363026214257477@g.us)│
└─────────────────────────────────────────────────────────────┘
                            ↓
    User sends: "I need valuation for 3BR HDB at Ang Mo Kio.
                 Please contact Yvonne. Asking $500k."
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. SYSTEM DETECTS                                           │
│    Trigger: "valuation request"                             │
│    Extract: Property details                                │
│    Route: Keyword "yvonne" → Yvonne (Premas)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. SAVE TO SUPABASE                                         │
│    Table: valuation_requests                                │
│    Fields:                                                  │
│      - group_id: 120363026214257477@g.us (Requester)        │
│      - sender_id: 6591234567@c.us                           │
│      - message_id: msg_req_001                              │
│      - banker_id: yvonne-uuid                               │
│      - target_group_id: 6596440186-1598498077@g.us (Yvonne) │
│      - request_message_id: msg_req_001 ← IMPORTANT!         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. FORWARD TO BANKER'S GROUP                                │
│    Group: "Premas Group" (6596440186-1598498077@g.us)       │
│    Message: "Hi Yvonne pls assist:                          │
│              3BR HDB at Ang Mo Kio. $500k"                  │
│    forward_message_id: msg_fwd_002 ← SAVE THIS!             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. ACKNOWLEDGE TO REQUESTER                                 │
│    Group: "Keyquest Mortgage Team"                          │
│    Message: "Thanks! Forwarded to Yvonne.                   │
│              We'll let you know when they reply."           │
│    acknowledgment_message_id: msg_ack_003                   │
└─────────────────────────────────────────────────────────────┘
```

---

### **FLOW 2: Reply (Banker → Requester)** ⚠️ **CRITICAL - MISSING!**

```
┌─────────────────────────────────────────────────────────────┐
│ 6. BANKER REPLIES IN THEIR GROUP                            │
│    Group: "Premas Group" (6596440186-1598498077@g.us)       │
│    Yvonne replies TO msg_fwd_002 (quoted message):          │
│                                                             │
│    "Based on recent transactions, estimated value is        │
│     $480k-$520k. I can arrange viewing. Contact me          │
│     at 9123-4567. - Yvonne (AG001)"                         │
│                                                             │
│    reply_message_id: msg_reply_004                          │
│    quoted_message_id: msg_fwd_002 ← LINKS BACK!             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. SYSTEM DETECTS BANKER REPLY                              │
│    Detection:                                               │
│      - Message is from banker's group                       │
│      - Message is REPLY to forward message (msg_fwd_002)    │
│      - Message contains agent number (AG001)                │
│                                                             │
│    Lookup in Supabase:                                      │
│      SELECT * FROM valuation_requests                       │
│      WHERE forward_message_id = 'msg_fwd_002'               │
│                                                             │
│    Found: Original requester group + message details        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. UPDATE SUPABASE                                          │
│    Table: valuation_requests                                │
│    Fields:                                                  │
│      - banker_reply_message_id: msg_reply_004               │
│      - banker_reply_text: "Based on recent..."             │
│      - banker_replied_at: 2025-10-03T08:30:00Z              │
│      - status: "replied_by_banker"                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. FORWARD REPLY TO REQUESTER                               │
│    Group: "Keyquest Mortgage Team" (120363026214257477@g.us)│
│    Message: "Reply from Yvonne (AG001):                     │
│                                                             │
│              Based on recent transactions, estimated value  │
│              is $480k-$520k. I can arrange viewing.         │
│              Contact me at 9123-4567. - Yvonne (AG001)"     │
│                                                             │
│    Sent as REPLY to original request (msg_req_001)          │
│    final_reply_message_id: msg_final_005                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. FINAL UPDATE                                            │
│     Table: valuation_requests                               │
│     Fields:                                                 │
│       - final_reply_sent: true                              │
│       - final_reply_message_id: msg_final_005               │
│       - status: "completed"                                 │
│       - completed_at: 2025-10-03T08:30:05Z                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ UPDATED Database Schema Needed

### **New Fields for `valuation_requests` Table**

```sql
ALTER TABLE valuation_requests
  -- Original request tracking (already have)
  ADD COLUMN IF NOT EXISTS request_message_id TEXT, -- Original request msg ID
  ADD COLUMN IF NOT EXISTS requester_group_id TEXT, -- Where request came from

  -- Forward tracking (already have)
  ADD COLUMN IF NOT EXISTS forward_message_id TEXT, -- Message sent to banker

  -- NEW: Banker reply tracking
  ADD COLUMN IF NOT EXISTS banker_reply_message_id TEXT, -- Banker's reply msg ID
  ADD COLUMN IF NOT EXISTS banker_reply_text TEXT, -- Banker's actual reply
  ADD COLUMN IF NOT EXISTS banker_replied_at TIMESTAMP WITH TIME ZONE,

  -- NEW: Final reply to requester tracking
  ADD COLUMN IF NOT EXISTS final_reply_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_reply_message_id TEXT, -- Reply forwarded to requester
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for fast lookups when banker replies
CREATE INDEX IF NOT EXISTS idx_valuation_forward_msg ON valuation_requests(forward_message_id);
CREATE INDEX IF NOT EXISTS idx_valuation_banker_group ON valuation_requests(target_group_id);
```

### **New Status Values**

Update status CHECK constraint:
```sql
ALTER TABLE valuation_requests
  DROP CONSTRAINT IF EXISTS valuation_requests_status_check;

ALTER TABLE valuation_requests
  ADD CONSTRAINT valuation_requests_status_check
  CHECK (status IN (
    'pending',           -- Just received
    'forwarded',         -- Sent to banker
    'replied_by_banker', -- Banker replied
    'completed',         -- Reply forwarded to requester
    'archived'           -- Old/closed
  ));
```

---

## 💻 Workflow Code - COMPLETE Implementation

### **Part 1: Handle Incoming Request** (Already documented)

```javascript
async function valuationWorkflowSupabase(payload, engine) {
  const { groupId, senderId, text, messageId, hasReply, replyInfo, workflowId } = payload;

  // Extract, route, save, forward, acknowledge...
  // (Already documented in previous version)
}
```

### **Part 2: Handle Banker Reply** ⚠️ **NEW - CRITICAL!**

```javascript
// NEW WORKFLOW: valuationReplyWorkflow.js
async function valuationReplyWorkflowSupabase(payload, engine) {
  const { groupId, senderId, text, messageId, hasReply, replyInfo } = payload;

  console.log('💬 Processing banker reply to valuation request');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    // Step 1: Verify this is a reply in a banker's group
    if (!hasReply || !replyInfo?.message_id) {
      console.log('❌ Not a reply message, skipping');
      return;
    }

    console.log(`🔍 Looking for valuation with forward_message_id: ${replyInfo.message_id}`);

    // Step 2: Find the original valuation request
    const { data: valuation, error } = await supabase
      .from('valuation_requests')
      .select('*')
      .eq('forward_message_id', replyInfo.message_id) // Match the message banker is replying to
      .eq('target_group_id', groupId) // Verify it's from correct banker group
      .single();

    if (error || !valuation) {
      console.log('❌ No matching valuation request found');
      return;
    }

    console.log(`✅ Found valuation request: ${valuation.id}`);
    console.log(`📍 Original requester group: ${valuation.group_id}`);

    // Step 3: Extract agent number from reply (optional validation)
    const agentNumberMatch = text.match(/AG\d{3}/i);
    const agentNumber = agentNumberMatch ? agentNumberMatch[0] : null;

    console.log(`👤 Agent number detected: ${agentNumber}`);

    // Step 4: Update valuation with banker's reply
    await supabase
      .from('valuation_requests')
      .update({
        banker_reply_message_id: messageId,
        banker_reply_text: text,
        banker_replied_at: new Date().toISOString(),
        status: 'replied_by_banker'
      })
      .eq('id', valuation.id);

    console.log('✅ Valuation updated with banker reply');

    // Step 5: Format reply message for requester
    const replyToRequester = `Reply from ${valuation.banker_name} (${agentNumber || valuation.banker_agent_number}):\n\n${text}`;

    // Step 6: Send reply back to original requester's group
    console.log(`📤 Forwarding reply to requester group: ${valuation.group_id}`);

    const finalReplyResult = await sendWhatsAppMessage({
      groupId: valuation.group_id, // Original requester's group
      message: replyToRequester,
      quotedMessageId: valuation.request_message_id // Reply to original request
    });

    // Step 7: Update valuation as completed
    await supabase
      .from('valuation_requests')
      .update({
        final_reply_sent: true,
        final_reply_message_id: finalReplyResult.messageId,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', valuation.id);

    console.log('✅ Reply forwarded to requester. Valuation completed!');

    return {
      success: true,
      message: 'Banker reply forwarded to requester',
      valuationId: valuation.id
    };

  } catch (error) {
    console.error('❌ Valuation Reply Workflow Error:', error);
    throw error;
  }
}

module.exports = valuationReplyWorkflowSupabase;
```

---

## 🔧 Detection Logic in Main Handler

### **Update `index.js` Message Handler**

```javascript
// In index.js - handleMessage function

// Existing valuation request detection
const isValuationRequest =
  text.toLowerCase().includes('valuation request');

// NEW: Banker reply detection
const isBankerReply = async () => {
  if (!hasReply || !replyInfo?.message_id) {
    return false;
  }

  // Check if this group is a banker's group
  const { data: banker } = await supabase
    .from('bankers')
    .select('id')
    .eq('whatsapp_group_id', groupId)
    .eq('is_active', true)
    .single();

  if (!banker) {
    return false; // Not from a banker's group
  }

  // Check if replying to a forward message
  const { data: valuation } = await supabase
    .from('valuation_requests')
    .select('id')
    .eq('forward_message_id', replyInfo.message_id)
    .eq('target_group_id', groupId)
    .single();

  return !!valuation; // True if found matching valuation
};

// Routing logic
if (isValuationRequest) {
  // Handle new valuation request
  await workflowEngine.execute('valuation', payload);
}
else if (await isBankerReply()) {
  // Handle banker reply
  await workflowEngine.execute('valuation_reply', payload);
}
```

---

## 📊 Complete Database Record Example

After FULL two-way flow, `valuation_requests` table looks like:

```sql
id:                        "val-uuid-123"

-- Request info
group_id:                  "120363026214257477@g.us" (Requester)
sender_id:                 "6591234567@c.us"
request_message_id:        "msg_req_001" ← Original request
message_id:                "msg_req_001"

-- Property data
address:                   "3BR HDB Ang Mo Kio"
asking_price:              500000

-- Banker assignment
banker_id:                 "yvonne-uuid"
banker_name:               "Yvonne"
banker_agent_number:       "AG001"
target_group_id:           "6596440186-1598498077@g.us" (Yvonne's group)

-- Forward to banker
forwarded_to_banker:       true
forward_message_id:        "msg_fwd_002" ← Sent to banker
forwarded_at:              "2025-10-03T08:00:00Z"

-- Acknowledgment to requester
acknowledgment_sent:       true
acknowledgment_message_id: "msg_ack_003"

-- Banker's reply
banker_reply_message_id:   "msg_reply_004" ← Banker replied
banker_reply_text:         "Estimated value $480k-$520k..."
banker_replied_at:         "2025-10-03T08:30:00Z"

-- Final reply to requester
final_reply_sent:          true
final_reply_message_id:    "msg_final_005" ← Forwarded to requester
completed_at:              "2025-10-03T08:30:05Z"

-- Status progression
status:                    "completed"
-- Was: pending → forwarded → replied_by_banker → completed

created_at:                "2025-10-03T08:00:00Z"
updated_at:                "2025-10-03T08:30:05Z"
```

---

## 🔄 Status Lifecycle

```
┌─────────┐     Forward     ┌───────────┐    Banker     ┌──────────────────┐
│ pending │ ─────────────→  │ forwarded │  ─────────→   │ replied_by_banker│
└─────────┘                 └───────────┘   replies     └──────────────────┘
                                                                  │
                                                                  │ Forward to
                                                                  │ requester
                                                                  ↓
                                                         ┌───────────┐
                                                         │ completed │
                                                         └───────────┘
```

---

## 📋 Summary - What Was Missing

### ❌ **I Missed:**
1. **Banker reply workflow** - Detecting when banker replies
2. **Reply message tracking** - banker_reply_message_id, banker_reply_text
3. **Forward reply back to requester** - Closing the loop
4. **Message linking** - Using forward_message_id to find original request
5. **Agent number in reply** - Including banker's agent number

### ✅ **Now Complete:**
1. ✅ Request → Banker (forward)
2. ✅ Banker → Requester (reply)
3. ✅ Complete tracking in database
4. ✅ Two-way communication loop closed

---

## 🎯 Tables Needed: **Still 3 Tables**

1. `valuation_requests` - Now with 12 additional fields for two-way tracking
2. `bankers` - Same as before
3. `banker_routing_rules` - Optional, same as before

But `valuation_requests` needs **significant updates** for reply tracking!

---

**Thank you for catching this critical missing piece!** 🙏

The two-way flow is ESSENTIAL for the workflow to work properly.
