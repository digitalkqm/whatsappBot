# 📋 Valuation Request Template - Complete Flow

## 📝 Template Structure

### **Incoming Valuation Request Format:**
```
Valuation Request:

Address: [property address]
Size: [floor area]
Asking: [asking price]
Salesperson Name: [name]
Agent Number: [AG###]
Banker Name: [banker name]
```

### **Example:**
```
Valuation Request:

Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
Salesperson Name: John Tan
Agent Number: AG888
Banker Name: Yvonne
```

---

## 🔄 Complete Two-Way Flow

### **STAGE 1: Request Received in Requester Group**

**Requester Group**: "Keyquest Mortgage Team" (120363026214257477@g.us)

**User sends:**
```
Valuation Request:

Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
Salesperson Name: John Tan
Agent Number: AG888
Banker Name: Yvonne
```

**System Actions:**
1. ✅ Detects "Valuation Request:" trigger
2. ✅ Extracts fields using template parser
3. ✅ Routes to banker based on "Banker Name: Yvonne"
4. ✅ Stores in database

**Database Record:**
```sql
request_message_id: 'msg_req_001'
requester_group_id: '120363026214257477@g.us'
address: 'Blk 123 Ang Mo Kio Ave 4, #05-678'
size: '1200 sqft'
asking_price: '$500,000'
salesperson_name: 'John Tan'
agent_number: 'AG888'
banker_name: 'Yvonne'
banker_id: 'yvonne-uuid'
target_group_id: '6596440186-1598498077@g.us' (Yvonne's group)
status: 'pending'
```

---

### **STAGE 2: Forward to Banker's Group**

**Banker Group**: "Premas Group" (6596440186-1598498077@g.us)

**System sends:**
```
Valuation Request:

Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
```

**Note**: Only forwards the 3 key fields (Address, Size, Asking) to the banker!

**Database Update:**
```sql
forwarded_to_banker: true
forward_message_id: 'msg_fwd_002' ← CRITICAL for linking!
forwarded_at: '2025-10-03T08:00:00Z'
status: 'forwarded'
```

---

### **STAGE 3: Acknowledge to Requester**

**Requester Group**: "Keyquest Mortgage Team"

**System sends:**
```
Thanks! We've forwarded your request to Yvonne.
We'll let you know when they replied.
```

**Database Update:**
```sql
acknowledgment_sent: true
acknowledgment_message_id: 'msg_ack_003'
acknowledgment_text: 'Thanks! We've forwarded...'
```

---

### **STAGE 4: Banker Replies** ⭐ **CRITICAL STAGE**

**Banker Group**: "Premas Group"

**Yvonne REPLIES (quotes) the forwarded message and says:**
```
Based on recent transactions in the area, estimated valuation is $480,000 to $520,000.
Property is well-maintained. Good buying opportunity.
Contact me for viewing arrangement.
- Yvonne (AG001)
```

**System Detects:**
1. ✅ Message is from banker's group (6596440186-1598498077@g.us)
2. ✅ Message is a REPLY (has quoted message)
3. ✅ Quoted message ID = 'msg_fwd_002'
4. ✅ Extracts banker's agent number from signature: "AG001"

**Database Lookup:**
```sql
SELECT * FROM valuation_requests
WHERE forward_message_id = 'msg_fwd_002'
AND target_group_id = '6596440186-1598498077@g.us';

-- Found! Gets:
-- - requester_group_id: '120363026214257477@g.us'
-- - agent_number: 'AG888' (original requester's agent)
-- - salesperson_name: 'John Tan'
-- - banker_name: 'Yvonne'
```

**Database Update:**
```sql
banker_reply_message_id: 'msg_reply_004'
banker_reply_text: 'Based on recent transactions...'
banker_replied_at: '2025-10-03T08:30:00Z'
status: 'replied_by_banker'
```

---

### **STAGE 5: Forward Reply to TWO Places** ⭐ **KEY DIFFERENCE!**

#### **5A: Forward to Original Requester Group**

**Requester Group**: "Keyquest Mortgage Team" (120363026214257477@g.us)

**System sends (with "From Banker" header):**
```
From Banker: Premas - Yvonne

Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
Valuation: Based on recent transactions in the area, estimated valuation is $480,000 to $520,000. Property is well-maintained. Good buying opportunity. Contact me for viewing arrangement. - Yvonne (AG001)
```

#### **5B: Forward to Agent's Private Chat**

**Agent Chat**: Private chat with AG888 (agent_number@c.us)

**System sends (clean format, no header):**
```
Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
Valuation: Based on recent transactions in the area, estimated valuation is $480,000 to $520,000. Property is well-maintained. Good buying opportunity. Contact me for viewing arrangement. - Yvonne (AG001)
```

**Database Update:**
```sql
final_reply_sent: true
final_reply_message_id: 'msg_final_005' (to requester group)
agent_notified: true
agent_notification_message_id: 'msg_agent_006' (to agent private chat)
status: 'completed'
completed_at: '2025-10-03T08:30:05Z'
```

---

## 🗄️ Updated Database Schema

### **New Fields Needed for `valuation_requests`:**

```sql
ALTER TABLE valuation_requests
  -- Template fields (parsed from incoming message)
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT, -- Keep as TEXT to preserve format like "1200 sqft"
  ADD COLUMN IF NOT EXISTS asking TEXT, -- Keep as TEXT to preserve "$500,000" format
  ADD COLUMN IF NOT EXISTS salesperson_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_number TEXT, -- AG### of the SALESPERSON
  ADD COLUMN IF NOT EXISTS banker_name_requested TEXT, -- What requester asked for

  -- Requester info
  ADD COLUMN IF NOT EXISTS requester_group_id TEXT,
  ADD COLUMN IF NOT EXISTS request_message_id TEXT,

  -- Banker assignment (system determined)
  ADD COLUMN IF NOT EXISTS banker_id UUID REFERENCES bankers(id),
  ADD COLUMN IF NOT EXISTS banker_name TEXT, -- Actual banker assigned
  ADD COLUMN IF NOT EXISTS banker_agent_number TEXT, -- Banker's agent number (AG001, AG002, etc.)
  ADD COLUMN IF NOT EXISTS target_group_id TEXT, -- Banker's WhatsApp group

  -- Forward to banker tracking
  ADD COLUMN IF NOT EXISTS forwarded_to_banker BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS forward_message_id TEXT, -- CRITICAL for linking!
  ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMP WITH TIME ZONE,

  -- Acknowledgment tracking
  ADD COLUMN IF NOT EXISTS acknowledgment_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledgment_message_id TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgment_text TEXT,

  -- Banker reply tracking
  ADD COLUMN IF NOT EXISTS banker_reply_message_id TEXT,
  ADD COLUMN IF NOT EXISTS banker_reply_text TEXT,
  ADD COLUMN IF NOT EXISTS banker_replied_at TIMESTAMP WITH TIME ZONE,

  -- Final reply to requester group
  ADD COLUMN IF NOT EXISTS final_reply_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_reply_message_id TEXT,

  -- NEW: Agent notification (private message to salesperson's agent number)
  ADD COLUMN IF NOT EXISTS agent_notified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_notification_message_id TEXT,
  ADD COLUMN IF NOT EXISTS agent_notified_at TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

---

## 💻 Template Parsing Function

```javascript
function parseValuationTemplate(text) {
  const data = {};

  // Check if it's a valuation request
  if (!text.toLowerCase().includes('valuation request:')) {
    return null;
  }

  // Parse each field using regex
  const addressMatch = text.match(/Address:\s*(.+?)(?=\n|$)/i);
  if (addressMatch) data.address = addressMatch[1].trim();

  const sizeMatch = text.match(/Size:\s*(.+?)(?=\n|$)/i);
  if (sizeMatch) data.size = sizeMatch[1].trim();

  const askingMatch = text.match(/Asking:\s*(.+?)(?=\n|$)/i);
  if (askingMatch) data.asking = askingMatch[1].trim();

  const salespersonMatch = text.match(/Salesperson Name:\s*(.+?)(?=\n|$)/i);
  if (salespersonMatch) data.salesperson_name = salespersonMatch[1].trim();

  const agentMatch = text.match(/Agent Number:\s*(AG\d+)/i);
  if (agentMatch) data.agent_number = agentMatch[1].trim().toUpperCase();

  const bankerMatch = text.match(/Banker Name:\s*(.+?)(?=\n|$)/i);
  if (bankerMatch) data.banker_name_requested = bankerMatch[1].trim();

  return data;
}

// Example usage:
const parsed = parseValuationTemplate(text);
// {
//   address: 'Blk 123 Ang Mo Kio Ave 4, #05-678',
//   size: '1200 sqft',
//   asking: '$500,000',
//   salesperson_name: 'John Tan',
//   agent_number: 'AG888',
//   banker_name_requested: 'Yvonne'
// }
```

---

## 📤 Forward Message Formats

### **To Banker Group (Only 3 fields):**
```javascript
function formatBankerMessage(data) {
  return `Valuation Request:

Address: ${data.address}
Size: ${data.size}
Asking: ${data.asking}`;
}
```

### **Reply to Requester Group (with "From Banker" header):**
```javascript
function formatRequesterReply(address, size, asking, bankName, bankerName, bankerReply) {
  return `From Banker: ${bankName} - ${bankerName}

Address: ${address}
Size: ${size}
Asking: ${asking}
Valuation: ${bankerReply}`;
}
```

### **Notification to Agent (clean format, no header):**
```javascript
function formatAgentNotification(address, size, asking, bankerReply) {
  return `Address: ${address}
Size: ${size}
Asking: ${asking}
Valuation: ${bankerReply}`;
}
```

---

## 🎯 Updated Workflow Summary

### **Request Workflow:**
1. ✅ Parse template from requester group
2. ✅ Extract: address, size, asking, salesperson, agent number, banker name
3. ✅ Route to banker based on "Banker Name" field
4. ✅ Save to database (all fields)
5. ✅ Forward to banker (ONLY: address, size, asking)
6. ✅ Acknowledge to requester group

### **Reply Workflow:**
1. ✅ Detect banker reply (quoted message in banker's group)
2. ✅ Lookup original request via `forward_message_id`
3. ✅ Extract banker's agent number from reply signature
4. ✅ Update database with reply
5. ✅ Forward reply to **TWO places**:
   - Requester group (as reply to original message)
   - Agent private chat (notification with details)
6. ✅ Mark as completed

---

## 📊 Data Flow Example

### **Complete Record in Database:**
```sql
id: 'val-uuid-123'

-- Parsed from template
address: 'Blk 123 Ang Mo Kio Ave 4, #05-678'
size: '1200 sqft'
asking: '$500,000'
salesperson_name: 'John Tan'
agent_number: 'AG888'
banker_name_requested: 'Yvonne'

-- System assigned
banker_id: 'yvonne-uuid'
banker_name: 'Yvonne'
banker_agent_number: 'AG001'
target_group_id: '6596440186-1598498077@g.us'

-- Request tracking
requester_group_id: '120363026214257477@g.us'
request_message_id: 'msg_req_001'

-- Forward tracking
forwarded_to_banker: true
forward_message_id: 'msg_fwd_002' ← KEY!
forwarded_at: '2025-10-03T08:00:00Z'

-- Acknowledgment
acknowledgment_sent: true
acknowledgment_message_id: 'msg_ack_003'

-- Banker reply
banker_reply_message_id: 'msg_reply_004'
banker_reply_text: 'Based on recent transactions...'
banker_replied_at: '2025-10-03T08:30:00Z'

-- Final replies
final_reply_sent: true
final_reply_message_id: 'msg_final_005' (to requester group)

agent_notified: true
agent_notification_message_id: 'msg_agent_006' (to AG888 private chat)
agent_notified_at: '2025-10-03T08:30:05Z'

-- Status
status: 'completed'
completed_at: '2025-10-03T08:30:05Z'
```

---

## ✅ Key Differences from Previous Understanding

| Aspect | Previous | **Correct** |
|--------|----------|-------------|
| Request format | Free text | **Structured template** |
| Fields forwarded to banker | All fields | **Only 3: Address, Size, Asking** |
| Reply destination | Requester group only | **TWO: Requester group + Agent private chat** |
| Agent number | Banker's agent number | **BOTH: Salesperson's (AG888) + Banker's (AG001)** |
| Template parsing | Generic extraction | **Specific field matching** |

---

## 🚀 Ready to Implement

With this complete understanding, I can now create:
1. ✅ Template parser
2. ✅ Request workflow (with template parsing)
3. ✅ Reply workflow (with dual forwarding)
4. ✅ Database schema (with all template fields)
5. ✅ Message formatters for each stage

**Confirm this is correct and I'll update the schema and create the workflows!** 🎯
