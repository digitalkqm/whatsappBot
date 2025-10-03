# 📋 Valuation Request - FINAL Correct Flow

## ✅ Clarification

**Agent Number**: There is ONLY ONE agent number per request
- It's the **salesperson's agent number** (e.g., AG888)
- Stored in database for record-keeping ONLY
- **NO private message sent to agent number**

**Reply Destination**: ONLY ONE place
- **Requester group** (where the original request came from)
- NOT sent to agent's private chat

---

## 📝 Template Structure

### **Incoming Valuation Request:**
```
Valuation Request:

Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
Salesperson Name: John Tan
Agent Number: AG888
Banker Name: Yvonne
```

**Parsed Fields:**
- `address`: "Blk 123 Ang Mo Kio Ave 4, #05-678"
- `size`: "1200 sqft"
- `asking`: "$500,000"
- `salesperson_name`: "John Tan" (stored for records)
- `agent_number`: "AG888" (stored for records)
- `banker_name_requested`: "Yvonne" (used for routing)

---

## 🔄 Complete Two-Way Flow

### **STAGE 1: Request Received**

**Requester Group**: "Keyquest Mortgage Team" (120363026214257477@g.us)

**User sends template message**

**System Actions:**
1. Detect "Valuation Request:" trigger
2. Parse all 6 fields from template
3. Route to banker based on "Banker Name: Yvonne"
4. Store ALL fields in database (for records)

**Database Record:**
```sql
-- Template fields (stored)
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

-- Tracking
requester_group_id: '120363026214257477@g.us'
request_message_id: 'msg_req_001'
status: 'pending'
```

---

### **STAGE 2: Forward to Banker's Group**

**Banker Group**: "Premas Group" (6596440186-1598498077@g.us)

**System sends (ONLY 3 fields):**
```
Valuation Request:

Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
```

**Database Update:**
```sql
forwarded_to_banker: true
forward_message_id: 'msg_fwd_002' ← CRITICAL!
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
```

---

### **STAGE 4: Banker Replies**

**Banker Group**: "Premas Group"

**Yvonne REPLIES (quotes msg_fwd_002):**
```
Based on recent transactions, estimated valuation is $480,000 to $520,000.
Property is well-maintained. Good buying opportunity.
Contact me for viewing arrangement.
- Yvonne (AG001)
```

**System Detects:**
1. Message from banker's group (6596440186-1598498077@g.us)
2. Message is REPLY (quoted message ID = 'msg_fwd_002')
3. Extracts banker's agent number: "AG001"

**Database Lookup:**
```sql
SELECT * FROM valuation_requests
WHERE forward_message_id = 'msg_fwd_002';
-- Found! Gets requester_group_id and all details
```

**Database Update:**
```sql
banker_reply_message_id: 'msg_reply_004'
banker_reply_text: 'Based on recent transactions...'
banker_replied_at: '2025-10-03T08:30:00Z'
status: 'replied_by_banker'
```

---

### **STAGE 5: Forward Formatted Reply to TWO Places**

#### **5A: To Requester Group**
**Requester Group**: "Keyquest Mortgage Team" (120363026214257477@g.us)

**System sends (with "From Banker" header):**
```
From Banker: Premas - Yvonne

Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
Valuation: Based on recent transactions, estimated valuation is $480,000 to $520,000. Property is well-maintained. Good buying opportunity. Contact me for viewing arrangement. - Yvonne (AG001)
```

#### **5B: To Agent's Private Chat**
**Agent**: AG888 private chat (converted to phone number, e.g., 6591234567@c.us)

**System sends (clean format, no header):**
```
Address: Blk 123 Ang Mo Kio Ave 4, #05-678
Size: 1200 sqft
Asking: $500,000
Valuation: Based on recent transactions, estimated valuation is $480,000 to $520,000. Property is well-maintained. Good buying opportunity. Contact me for viewing arrangement. - Yvonne (AG001)
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

## 🗄️ Database Schema (Simplified)

### **`valuation_requests` Table:**

```sql
CREATE TABLE IF NOT EXISTS valuation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template fields (parsed and stored for records)
  address TEXT,
  size TEXT,
  asking TEXT,
  salesperson_name TEXT, -- Just for records
  agent_number TEXT, -- Just for records (NOT used for messaging)
  banker_name_requested TEXT, -- Used for routing

  -- Requester info
  requester_group_id TEXT,
  request_message_id TEXT,

  -- Banker assignment (system)
  banker_id UUID REFERENCES bankers(id),
  banker_name TEXT,
  banker_agent_number TEXT, -- Banker's AG number (e.g., AG001)
  target_group_id TEXT,

  -- Forward tracking
  forwarded_to_banker BOOLEAN DEFAULT false,
  forward_message_id TEXT, -- CRITICAL for linking!
  forwarded_at TIMESTAMP WITH TIME ZONE,

  -- Acknowledgment tracking
  acknowledgment_sent BOOLEAN DEFAULT false,
  acknowledgment_message_id TEXT,

  -- Banker reply tracking
  banker_reply_message_id TEXT,
  banker_reply_text TEXT,
  banker_replied_at TIMESTAMP WITH TIME ZONE,

  -- Final reply to requester group AND agent
  final_reply_sent BOOLEAN DEFAULT false,
  final_reply_message_id TEXT, -- Message sent to requester group

  -- Agent notification (private message to agent number)
  agent_notified BOOLEAN DEFAULT false,
  agent_notification_message_id TEXT, -- Message sent to agent's private chat
  agent_phone_number TEXT, -- Cached phone number derived from agent_number

  -- Status and timestamps
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'forwarded', 'replied_by_banker', 'completed', 'archived')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Existing fields from original schema
  group_id TEXT, -- Same as requester_group_id
  sender_id TEXT,
  message_id TEXT, -- Same as request_message_id
  raw_message TEXT,
  reply_message TEXT,
  workflow_id UUID REFERENCES workflows(id),
  admin_notes TEXT,
  follow_up_date DATE,
  assigned_to TEXT
);
```

**Key Points:**
- `agent_number` field exists but is **ONLY for record-keeping**
- **NO** `agent_notified` field (removed)
- **NO** `agent_notification_message_id` field (removed)
- Reply forwarded **ONLY** to `requester_group_id`

---

## 💻 Template Parsing Function

```javascript
function parseValuationTemplate(text) {
  // Check if it's a valuation request
  if (!text.toLowerCase().includes('valuation request:')) {
    return null;
  }

  const data = {};

  // Parse each field
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
```

---

## 📤 Message Formats

### **1. To Banker Group (3 fields only):**
```javascript
function formatBankerMessage(data) {
  return `Valuation Request:

Address: ${data.address}
Size: ${data.size}
Asking: ${data.asking}`;
}
```

### **2. Acknowledgment to Requester:**
```javascript
function formatAcknowledgment(bankerName) {
  return `Thanks! We've forwarded your request to ${bankerName}.
We'll let you know when they replied.`;
}
```

### **3. Reply to Requester Group (with "From Banker" header):**
```javascript
function formatRequesterReply(address, size, asking, bankName, bankerName, bankerReply) {
  return `From Banker: ${bankName} - ${bankerName}

Address: ${address}
Size: ${size}
Asking: ${asking}
Valuation: ${bankerReply}`;
}

// Example output to requester group:
// From Banker: Premas - Yvonne
//
// Address: Blk 123 Ang Mo Kio Ave 4, #05-678
// Size: 1200 sqft
// Asking: $500,000
// Valuation: Based on recent transactions, estimated valuation is $480,000 to $520,000...
```

### **4. Notification to Agent (clean format, no header):**
```javascript
function formatAgentNotification(address, size, asking, bankerReply) {
  return `Address: ${address}
Size: ${size}
Asking: ${asking}
Valuation: ${bankerReply}`;
}

// Example output to agent private chat:
// Address: Blk 123 Ang Mo Kio Ave 4, #05-678
// Size: 1200 sqft
// Asking: $500,000
// Valuation: Based on recent transactions, estimated valuation is $480,000 to $520,000...
```

---

## 📊 Complete Database Record Example

```sql
id: 'val-uuid-123'

-- Template fields (stored for records)
address: 'Blk 123 Ang Mo Kio Ave 4, #05-678'
size: '1200 sqft'
asking: '$500,000'
salesperson_name: 'John Tan'
agent_number: 'AG888' ← JUST STORED, NO MESSAGING
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

-- Final reply to requester group AND agent
final_reply_sent: true
final_reply_message_id: 'msg_final_005' (to requester group)
agent_notified: true
agent_notification_message_id: 'msg_agent_006' (to agent private chat)
agent_phone_number: '6591234567' (derived from AG888)

-- Status
status: 'completed'
completed_at: '2025-10-03T08:30:05Z'
created_at: '2025-10-03T08:00:00Z'
updated_at: '2025-10-03T08:30:05Z'
```

---

## 🎯 Summary - Key Points

✅ **Template Parsing**: 6 fields extracted from structured format
✅ **Forward to Banker**: ONLY 3 fields (Address, Size, Asking)
✅ **Agent Number**: Stored in database AND used to send private notification
✅ **Reply Destination**: TWO places - Requester group + Agent private chat
✅ **Reply Format**: Same format for both (Address, Size, Asking, Valuation)
✅ **Two-Way Complete**: Request → Banker → Reply → Requester group

✅ **Agent private notifications** - Same formatted message
✅ **Dual forwarding** - Requester group + Agent private chat

---

## 🗂️ Final Tables Summary

**3 Tables Total:**

1. **`valuation_requests`**
   - Template fields (6 columns)
   - Tracking fields (15 columns)
   - Metadata fields (8 columns)
   - Total: ~29 columns

2. **`bankers`**
   - 14 bankers with routing keywords

3. **`banker_routing_rules`**
   - Optional routing configuration

---

**Ready to create the final schema and workflows?** 🚀
