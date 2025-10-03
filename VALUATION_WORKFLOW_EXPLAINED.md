# 📊 Valuation Workflow - Complete Explanation

## Overview

The valuation workflow involves **3 main tables** working together to handle property valuation requests from WhatsApp and route them to the appropriate bankers.

---

## 🗄️ Database Tables for Valuation Workflow

### **Table 1: `valuation_requests`** (Main data storage)
**Purpose**: Stores every valuation request received via WhatsApp

**Key Fields**:
```sql
id                          UUID (Primary Key)
group_id                    TEXT - WhatsApp group where request came from
sender_id                   TEXT - Person who sent the request
message_id                  TEXT - Unique WhatsApp message ID

-- Property Details (Extracted from message)
address                     TEXT
property_type               TEXT (HDB/Condo/Landed/Apartment)
bedrooms                    INTEGER
floor_area                  INTEGER (sqft)
asking_price                DECIMAL

-- Message Content
raw_message                 TEXT - Original message text
reply_message               TEXT - If replying to another message
cleaned_message             TEXT - Processed/cleaned message for banker

-- Banker Assignment (NEW!)
banker_id                   UUID - Which banker handles this
banker_name                 TEXT - Cached name (e.g., "Yvonne")
banker_agent_number         TEXT - Agent number (e.g., "AG001")
target_group_id             TEXT - Banker's WhatsApp group ID

-- Tracking
forwarded_to_banker         BOOLEAN - Was it sent to banker?
forwarded_at                TIMESTAMP - When was it forwarded?
forward_message_id          TEXT - WhatsApp message ID of forward

acknowledgment_sent         BOOLEAN - Was auto-reply sent?
acknowledgment_message_id   TEXT - WhatsApp message ID of ack
acknowledgment_text         TEXT - The actual ack message

-- Status & Workflow
workflow_id                 UUID - Links to workflows table
status                      TEXT (pending/processed/replied/archived)
admin_notes                 TEXT - Manual notes
follow_up_date              DATE - Schedule follow-ups
assigned_to                 TEXT - Team member assigned

created_at                  TIMESTAMP
updated_at                  TIMESTAMP
```

**Row Count**: Grows with each valuation request (could be thousands over time)

---

### **Table 2: `bankers`** (Banker management)
**Purpose**: Stores all bankers who can receive valuation requests

**Key Fields**:
```sql
id                          UUID (Primary Key)
name                        TEXT - Short name (e.g., "Yvonne", "Ethan")
display_name                TEXT - Full name for display
agent_number                TEXT - Agent ID (e.g., "AG001")

bank_name                   TEXT - Bank (Premas, DBS, MBB, OCBC, UOB, SCB)
organization                TEXT - Company name

whatsapp_group_id           TEXT - Target WhatsApp group to forward requests
whatsapp_group_name         TEXT - Display name of group

routing_keywords            JSONB - Keywords to match (["yvonne", "premas"])

is_active                   BOOLEAN - Is banker active?
priority                    INTEGER - Higher = checked first in routing

total_valuations            INTEGER - Auto-incremented counter
last_assigned_at            TIMESTAMP - Last time assigned

created_at                  TIMESTAMP
updated_at                  TIMESTAMP
```

**Row Count**: 14 bankers (relatively static, only grows when adding new bankers)

---

### **Table 3: `banker_routing_rules`** (Advanced routing - Optional)
**Purpose**: Define specific keyword → banker routing rules (alternative to JSONB keywords)

**Key Fields**:
```sql
id                          UUID (Primary Key)
banker_id                   UUID - References bankers(id)

keyword                     TEXT - Keyword to match
match_type                  TEXT - 'contains' / 'exact' / 'regex'
priority                    INTEGER - Higher priority checked first

is_active                   BOOLEAN
created_at                  TIMESTAMP
updated_at                  TIMESTAMP
```

**Row Count**: Variable (each banker could have multiple rules)

**Note**: This table is OPTIONAL. Currently, we're using the `routing_keywords` JSONB field in the `bankers` table for simplicity.

---

## 🔄 Complete Workflow Flow

### **Stage 1: Request Received** 📨

```
User sends WhatsApp message:
"Hi, I need a valuation for a 3-bedroom HDB at Blk 123 Ang Mo Kio Ave 4.
Floor area is 1200 sqft. Asking price $500,000. Please contact Yvonne."

                    ↓

WhatsApp Client detects trigger: "valuation request" keyword
```

---

### **Stage 2: Workflow Triggered** ⚙️

```javascript
// In index.js - Message handler
const isValuationMessage =
  text.toLowerCase().includes('valuation request') ||
  (hasReply && replyInfo?.text?.toLowerCase().includes('valuation request'));

if (isValuationMessage) {
  await workflowEngine.execute('valuation', {
    groupId,
    senderId,
    text,
    messageId,
    hasReply,
    replyInfo,
    workflowId
  });
}
```

---

### **Stage 3: Extract Property Data** 🏠

```javascript
// In valuationSupabase.js
function extractValuationData(text, replyInfo) {
  return {
    address: extractFromPattern(text, /address|location|property/i),
    propertyType: extractFromPattern(text, /HDB|Condo|Landed/i),
    bedrooms: extractFromPattern(text, /(\d+)\s*(?:bed|bedroom)/i),
    floorArea: extractFromPattern(text, /(\d+)\s*(?:sqft|sq ft)/i),
    askingPrice: extractFromPattern(text, /\$?([0-9,]+)/i),
    rawMessage: text,
    replyMessage: replyInfo?.text || null
  };
}

// Extracted:
{
  address: "Blk 123 Ang Mo Kio Ave 4",
  propertyType: "HDB",
  bedrooms: 3,
  floorArea: 1200,
  askingPrice: 500000,
  rawMessage: "...",
  replyMessage: null
}
```

---

### **Stage 4: Route to Banker** 🎯

```javascript
// Find banker based on keywords in message
async function routeToBanker(supabase, messageText) {
  const lowerText = messageText.toLowerCase();

  // Query bankers table with routing keywords
  const { data: bankers } = await supabase
    .from('bankers')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  // Check each banker's keywords
  for (const banker of bankers) {
    const keywords = banker.routing_keywords || [];

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return banker; // Found match!
      }
    }
  }

  // No match? Return first active banker as default
  return bankers[0] || null;
}

// Message contains "yvonne" → Routes to Yvonne
// Returns:
{
  id: "banker-uuid-123",
  name: "Yvonne",
  display_name: "Yvonne",
  bank_name: "Premas",
  whatsapp_group_id: "6596440186-1598498077@g.us",
  routing_keywords: ["yvonne", "premas"],
  priority: 10
}
```

**Database Function Alternative**:
```sql
-- Can also use database function
SELECT route_to_banker('Please contact yvonne for this valuation');
-- Returns: banker UUID
```

---

### **Stage 5: Save to Database** 💾

```javascript
// Insert into valuation_requests table
const { data: savedValuation, error } = await supabase
  .from('valuation_requests')
  .insert({
    // WhatsApp info
    group_id: "120363026214257477@g.us", // Requester's group
    sender_id: "6591234567@c.us",
    message_id: "msg_abc123",

    // Extracted property data
    address: "Blk 123 Ang Mo Kio Ave 4",
    property_type: "HDB",
    bedrooms: 3,
    floor_area: 1200,
    asking_price: 500000,
    raw_message: "Hi, I need a valuation...",
    reply_message: null,
    cleaned_message: "Hi, I need a valuation for a 3-bedroom HDB...",

    // Banker assignment
    banker_id: "banker-uuid-123",
    banker_name: "Yvonne",
    banker_agent_number: "AG001",
    target_group_id: "6596440186-1598498077@g.us", // Yvonne's group

    // Tracking (initial state)
    forwarded_to_banker: false,
    forwarded_at: null,
    acknowledgment_sent: false,

    // Workflow
    workflow_id: "valuation-workflow-uuid",
    status: "pending",

    created_at: NOW(),
    updated_at: NOW()
  })
  .select()
  .single();

// Saved! savedValuation.id = "valuation-uuid-789"
```

**Database Trigger**: Automatically increments `bankers.total_valuations` for Yvonne

---

### **Stage 6: Forward to Banker's WhatsApp Group** 📤

```javascript
// Prepare message for banker
const forwardMessage = `Hi ${banker.display_name} pls assist:

${savedValuation.cleaned_message}`;

// Send to banker's WhatsApp group
const forwardResult = await sendWhatsAppMessage({
  groupId: banker.whatsapp_group_id, // "6596440186-1598498077@g.us"
  message: forwardMessage
});

// Update valuation_requests: Mark as forwarded
await supabase
  .from('valuation_requests')
  .update({
    forwarded_to_banker: true,
    forwarded_at: new Date().toISOString(),
    forward_message_id: forwardResult.messageId
  })
  .eq('id', savedValuation.id);
```

**Result**: Yvonne's WhatsApp group receives:
```
Hi Yvonne pls assist:

Hi, I need a valuation for a 3-bedroom HDB at Blk 123 Ang Mo Kio Ave 4.
Floor area is 1200 sqft. Asking price $500,000.
```

---

### **Stage 7: Send Acknowledgment to Requester** ✅

```javascript
// Prepare acknowledgment message
const ackMessage = `Thanks! We've forwarded your request to ${banker.display_name}.
We'll let you know when they replied.`;

// Send to requester's group
const ackResult = await sendWhatsAppMessage({
  groupId: "120363026214257477@g.us", // Original requester's group
  message: ackMessage
});

// Update valuation_requests: Mark acknowledgment sent
await supabase
  .from('valuation_requests')
  .update({
    acknowledgment_sent: true,
    acknowledgment_message_id: ackResult.messageId,
    acknowledgment_text: ackMessage,
    status: "replied" // Status updated to "replied"
  })
  .eq('id', savedValuation.id);
```

**Result**: Requester's group receives:
```
Thanks! We've forwarded your request to Yvonne.
We'll let you know when they replied.
```

---

### **Stage 8: Final Database State** 💾

After workflow completes, `valuation_requests` table has:

```sql
id:                        "valuation-uuid-789"
group_id:                  "120363026214257477@g.us"
sender_id:                 "6591234567@c.us"
message_id:                "msg_abc123"

address:                   "Blk 123 Ang Mo Kio Ave 4"
property_type:             "HDB"
bedrooms:                  3
floor_area:                1200
asking_price:              500000

raw_message:               "Hi, I need a valuation..."
cleaned_message:           "Hi, I need a valuation for a 3-bedroom..."

banker_id:                 "banker-uuid-123"
banker_name:               "Yvonne"
banker_agent_number:       "AG001"
target_group_id:           "6596440186-1598498077@g.us"

forwarded_to_banker:       true
forwarded_at:              "2025-10-03T07:30:00Z"
forward_message_id:        "msg_forward_xyz"

acknowledgment_sent:       true
acknowledgment_message_id: "msg_ack_abc"
acknowledgment_text:       "Thanks! We've forwarded..."

workflow_id:               "valuation-workflow-uuid"
status:                    "replied"

created_at:                "2025-10-03T07:29:55Z"
updated_at:                "2025-10-03T07:30:05Z"
```

And `bankers` table updated:
```sql
-- Yvonne's record
total_valuations:          46 (incremented from 45)
last_assigned_at:          "2025-10-03T07:29:55Z"
```

---

## 📊 Table Relationships

```
┌─────────────────────┐
│   bankers           │
│  (14 rows)          │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ whatsapp_group_id   │
│ routing_keywords    │
│ total_valuations    │
└─────────────────────┘
         ↑
         │ banker_id (FK)
         │
┌─────────────────────┐
│ valuation_requests  │
│  (1000s of rows)    │
├─────────────────────┤
│ id (PK)             │
│ banker_id (FK) ─────┘
│ property details    │
│ tracking fields     │
└─────────────────────┘
         ↑
         │ workflow_id (FK)
         │
┌─────────────────────┐
│   workflows         │
│  (existing)         │
├─────────────────────┤
│ id (PK)             │
│ name: "valuation"   │
└─────────────────────┘
```

---

## 🔍 Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    WhatsApp Message                          │
│  "I need a valuation for 3BR HDB. Contact Yvonne"            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│              Workflow Engine (valuationSupabase.js)          │
│  1. Extract property data                                    │
│  2. Route to banker (check routing_keywords)                 │
│  3. Save to valuation_requests                               │
│  4. Forward to banker's WhatsApp group                       │
│  5. Send acknowledgment to requester                         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                     Supabase Database                        │
│                                                              │
│  ┌────────────────────┐        ┌──────────────────────┐    │
│  │ bankers            │◄───────│ valuation_requests   │    │
│  │                    │        │                      │    │
│  │ Yvonne (Premas)    │        │ Property: 3BR HDB    │    │
│  │ group: 6596...@g.us│        │ Banker: Yvonne       │    │
│  │ keywords: [yvonne] │        │ Forwarded: ✅        │    │
│  │ total_val: 46      │        │ Ack sent: ✅         │    │
│  └────────────────────┘        └──────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   WhatsApp Messages Sent                     │
│                                                              │
│  To Yvonne's Group:    To Requester's Group:                │
│  "Hi Yvonne pls        "Thanks! We've forwarded              │
│   assist: 3BR HDB..."   your request to Yvonne..."          │
└──────────────────────────────────────────────────────────────┘
```

---

## 📈 Data Growth Over Time

| Table | Initial Size | After 100 Requests | After 1000 Requests |
|-------|--------------|-------------------|---------------------|
| `bankers` | 14 rows | 14 rows | 14 rows (static) |
| `valuation_requests` | 0 rows | 100 rows | 1000 rows (grows) |
| `banker_routing_rules` | 0 rows | 0 rows (optional) | 0 rows (optional) |

---

## 🎯 Key Features

### ✅ **Automatic Routing**
- Detects banker name in message → routes automatically
- Keyword matching: "yvonne" → Yvonne, "ethan" → Ethan, "dbs" → Ethan
- Fallback: If no keyword match → routes to highest priority banker

### ✅ **Dual Messaging**
1. **Forward to Banker**: Sends cleaned message to banker's WhatsApp group
2. **Acknowledge Requester**: Confirms request received and forwarded

### ✅ **Complete Tracking**
- Who requested it? → `sender_id`, `group_id`
- What property? → `address`, `property_type`, `bedrooms`, etc.
- Who handles it? → `banker_id`, `banker_name`
- Was it forwarded? → `forwarded_to_banker`, `forwarded_at`
- Was ack sent? → `acknowledgment_sent`, `acknowledgment_message_id`

### ✅ **Performance Stats**
- Banker stats auto-updated via database trigger
- View `vw_banker_performance` shows total valuations per banker
- View `vw_recent_valuations` shows all valuations with banker info

---

## 🔄 Comparison: Old vs New

### **Old System (n8n + Google Sheets)**
```
Message → n8n webhook → Extract data → Switch node (route) →
Google Sheets (append row) → Send to banker group → Send ack
```

**Issues**:
- No banker management
- Hard-coded routing in n8n workflow
- No tracking of forwards/acks
- Rate limits on Google Sheets API
- No performance stats

### **New System (Supabase + Workflow)**
```
Message → Workflow engine → Route via DB query → Save to Supabase →
Forward (tracked) → Ack (tracked) → Auto-update stats
```

**Benefits**:
✅ Banker management in database
✅ Dynamic routing via keywords
✅ Complete tracking
✅ No API rate limits
✅ Real-time stats and views
✅ Excel-like UI for management

---

## 📋 Summary

**Tables**: 3 main tables
1. `valuation_requests` - Stores every request (main table)
2. `bankers` - Stores banker info and routing
3. `banker_routing_rules` - Advanced routing (optional)

**Workflow**: 8 stages
1. Request received
2. Workflow triggered
3. Extract property data
4. Route to banker
5. Save to database
6. Forward to banker
7. Send acknowledgment
8. Final state saved

**Result**: Complete tracking from request → routing → forwarding → acknowledgment, all stored in Supabase with real-time stats.
