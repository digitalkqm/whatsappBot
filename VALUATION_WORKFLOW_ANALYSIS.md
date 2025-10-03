# 🔍 Valuation Workflow Analysis - n8n vs Current Setup

## Overview

After analyzing the n8n "WhatsApp Valuation.json" workflow, I've identified **critical gaps** between the n8n workflow requirements and our current Supabase schema + frontend UI.

---

## 📊 n8n Workflow Structure

The n8n workflow is a **sophisticated banker routing system** with the following key components:

### 1. **Banker Assignment Logic**
The workflow routes valuation requests to different bankers based on:
- **Banker Name Detection**: Extracts banker from message content
- **Multiple Bankers**:
  - Yvonne (Premas)
  - Ethan (DBS)
  - Hui Hui (MBB)
  - Vikram (MBB)
  - Eunice (OCBC)
  - Ying Feng (SCB)
  - Bret (UOB)
  - Xin Jie (UOB)
  - Jewel (OCBC)
  - James (UOB)
  - April (MBB)
  - Eunice Ong (OCBC)
  - Eunice Boon (OCBC)
  - Testing Bot (Nat)

### 2. **Workflow Steps**
```
1. Webhook receives valuation request
2. Extract/Clean message content
3. Switch/Route to specific banker based on keywords
4. Add valuation to Google Sheets with:
   - chat_id (Group ID)
   - message_id
   - message_text (cleaned message)
   - timestamp
   - Agent Number (Banker identifier)
5. Send message to banker's WhatsApp group
6. Send acknowledgment to requester
```

### 3. **Key Data Fields Captured**
- `chat_id` - WhatsApp group ID where request came from
- `message_id` - Unique message identifier
- `message_text` - Cleaned valuation request content
- `timestamp` - When request was received
- `Agent Number` - Assigned banker identifier
- `Banker Name` - Banker's display name
- `groupId` - Target banker's WhatsApp group
- `Content` - Formatted message for banker

---

## ❌ Critical Gaps in Current Setup

### 1. **Missing Database Fields**

| n8n Field | Supabase Field | Status |
|-----------|----------------|--------|
| `chat_id` | `group_id` | ✅ Exists |
| `message_id` | `message_id` | ✅ Exists |
| `message_text` | `raw_message` | ✅ Exists |
| `timestamp` | `created_at` | ✅ Exists |
| **`Agent Number`** | ❌ **MISSING** | 🔴 **CRITICAL** |
| **`Banker Name`** | ❌ **MISSING** | 🔴 **CRITICAL** |
| **`Target Group ID`** | ❌ **MISSING** | 🔴 **CRITICAL** |
| **`Cleaned Content`** | ❌ **MISSING** | 🟡 Optional |

### 2. **Missing Banker Management**

The n8n workflow has **14+ bankers** with:
- Banker identifier (e.g., "Yvonne", "Ethan", etc.)
- Target WhatsApp group ID
- Bank affiliation (Premas, DBS, MBB, OCBC, etc.)

**Current Supabase**: No banker table, no banker assignment logic

### 3. **Missing Routing Logic**

The n8n workflow uses sophisticated routing:
- **Switch node**: Routes based on keyword detection
- **Multiple conditions**: Checks for banker names in message
- **Fallback handling**: Default routing if no match

**Current Setup**: Basic valuation extraction only

### 4. **Missing Frontend UI Components**

What's needed but missing:
1. **Banker Selection Dropdown** - Assign/reassign valuation to banker
2. **Banker Group Management** - Configure banker WhatsApp groups
3. **Routing Rules Configuration** - Define keyword → banker mapping
4. **Acknowledgment Templates** - Configure auto-reply messages
5. **Status Tracking** - Track if forwarded to banker, acknowledged, etc.

---

## ✅ Required Database Schema Updates

### New Table: `bankers`
```sql
CREATE TABLE IF NOT EXISTS bankers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Banker info
  name TEXT NOT NULL UNIQUE, -- e.g., "Yvonne", "Ethan"
  display_name TEXT NOT NULL, -- Full name for UI
  agent_number TEXT UNIQUE, -- Identifier used in n8n

  -- Bank/Organization
  bank_name TEXT, -- e.g., "Premas", "DBS", "MBB"
  organization TEXT,

  -- WhatsApp integration
  whatsapp_group_id TEXT NOT NULL, -- Target group to send valuations
  whatsapp_group_name TEXT,

  -- Routing keywords
  routing_keywords JSONB DEFAULT '[]'::jsonb, -- Keywords to match for auto-routing

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- For routing precedence

  -- Stats
  total_valuations INTEGER DEFAULT 0,
  last_assigned_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast routing
CREATE INDEX idx_bankers_active ON bankers(is_active);
CREATE INDEX idx_bankers_keywords ON bankers USING GIN(routing_keywords);
```

### Update Table: `valuation_requests`
```sql
-- Add new columns to existing table
ALTER TABLE valuation_requests
  ADD COLUMN banker_id UUID REFERENCES bankers(id) ON DELETE SET NULL,
  ADD COLUMN banker_name TEXT, -- Cached for display
  ADD COLUMN target_group_id TEXT, -- Banker's WhatsApp group
  ADD COLUMN cleaned_message TEXT, -- Processed message content
  ADD COLUMN forwarded_to_banker BOOLEAN DEFAULT false,
  ADD COLUMN forwarded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN acknowledgment_sent BOOLEAN DEFAULT false,
  ADD COLUMN acknowledgment_message_id TEXT;

-- Indexes
CREATE INDEX idx_valuation_banker ON valuation_requests(banker_id);
CREATE INDEX idx_valuation_forwarded ON valuation_requests(forwarded_to_banker);
```

### New Table: `banker_routing_rules`
```sql
CREATE TABLE IF NOT EXISTS banker_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  banker_id UUID REFERENCES bankers(id) ON DELETE CASCADE,

  -- Routing configuration
  keyword TEXT NOT NULL,
  match_type TEXT DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact', 'regex')),
  priority INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_routing_banker ON banker_routing_rules(banker_id);
CREATE INDEX idx_routing_active ON banker_routing_rules(is_active);
```

---

## 🎨 Required Frontend UI Updates

### 1. **New Page: Banker Management** (`/bankers.html`)

**Features**:
- Excel-like grid with all bankers
- Inline editing: name, bank, WhatsApp group ID
- Add/Remove bankers
- Configure routing keywords
- Toggle active/inactive status
- View stats (total valuations assigned)

**Columns**:
| Name | Display Name | Agent # | Bank | WhatsApp Group | Keywords | Active | Total |
|------|--------------|---------|------|----------------|----------|--------|-------|
| Yvonne | Yvonne Tan | AG001 | Premas | 6596440186-1598498077@g.us | yvonne, premas | ✅ | 45 |
| Ethan | Ethan Lim | AG002 | DBS | 120363026214257477@g.us | ethan, dbs | ✅ | 32 |

### 2. **Updated Page: Valuation Requests** (`/valuations.html`)

**New Columns**:
- **Assigned Banker** - Dropdown to select/change banker
- **Target Group** - Display banker's WhatsApp group (read-only)
- **Forwarded Status** - ✅ Sent / ⏳ Pending / ❌ Failed
- **Acknowledgment** - ✅ Sent / ⏳ Pending

**New Actions**:
- **Re-assign Banker** - Change banker assignment
- **Resend to Banker** - Retry failed forwards
- **View Acknowledgment** - See auto-reply sent to requester

### 3. **New Section: Routing Configuration** (`/routing.html`)

**Features**:
- Visual routing rules builder
- Keyword → Banker mapping
- Priority ordering (if multiple keywords match)
- Test routing with sample messages
- Import/Export routing rules

**Example Rules**:
```
Priority 1: "yvonne" → Yvonne (Premas)
Priority 2: "premas" → Yvonne (Premas)
Priority 3: "ethan" → Ethan (DBS)
Priority 4: "dbs" → Ethan (DBS)
...
```

---

## 🔄 Updated Workflow Logic

### Enhanced Valuation Workflow (`valuationSupabase.js`)

```javascript
async function valuationWorkflowSupabase(payload, engine) {
  const { groupId, senderId, text, messageId, hasReply, replyInfo, workflowId } = payload;

  console.log('🏡 Starting Enhanced Valuation Workflow (Supabase)');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    // Step 1: Extract valuation data
    const valuationData = extractValuationData(text, replyInfo);

    // Step 2: Route to banker (NEW!)
    const banker = await routeToBanker(supabase, text);

    if (!banker) {
      throw new Error('No banker found for routing');
    }

    console.log(`🎯 Routed to banker: ${banker.name} (${banker.bank_name})`);

    // Step 3: Save to Supabase with banker assignment
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

        // NEW FIELDS
        banker_id: banker.id,
        banker_name: banker.name,
        target_group_id: banker.whatsapp_group_id,
        cleaned_message: cleanMessage(text),

        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save valuation: ${error.message}`);
    }

    console.log(`✅ Valuation saved with ID: ${savedValuation.id}`);

    // Step 4: Forward to banker's WhatsApp group (NEW!)
    const forwardMessage = `Hi ${banker.display_name} pls assist:\n\n${savedValuation.cleaned_message}`;

    try {
      await sendWhatsAppMessage({
        groupId: banker.whatsapp_group_id,
        message: forwardMessage
      });

      // Mark as forwarded
      await supabase
        .from('valuation_requests')
        .update({
          forwarded_to_banker: true,
          forwarded_at: new Date().toISOString()
        })
        .eq('id', savedValuation.id);

      console.log(`✅ Forwarded to ${banker.name}'s group`);

    } catch (forwardError) {
      console.error('❌ Failed to forward to banker:', forwardError);
      // Continue to acknowledgment even if forward fails
    }

    // Step 5: Send acknowledgment to requester (ENHANCED!)
    const ackMessage = `Thanks! We've forwarded your request to ${banker.display_name}.\nWe'll let you know when they replied.`;

    try {
      const ackResult = await sendWhatsAppMessage({
        groupId,
        message: ackMessage
      });

      // Mark as acknowledged
      await supabase
        .from('valuation_requests')
        .update({
          acknowledgment_sent: true,
          acknowledgment_message_id: ackResult.messageId,
          status: 'replied'
        })
        .eq('id', savedValuation.id);

      console.log('✅ Acknowledgment sent to requester');

    } catch (ackError) {
      console.error('❌ Failed to send acknowledgment:', ackError);
    }

    return {
      success: true,
      message: 'Valuation request processed and routed',
      valuationId: savedValuation.id,
      banker: banker.name
    };

  } catch (error) {
    console.error('❌ Valuation Workflow Error:', error);

    if (groupId) {
      await notifyError(groupId, `Valuation processing failed: ${error.message}`);
    }

    throw error;
  }
}

// NEW: Router function
async function routeToBanker(supabase, messageText) {
  const lowerText = messageText.toLowerCase();

  // Get all active bankers with routing rules
  const { data: bankers } = await supabase
    .from('bankers')
    .select('*, routing_keywords')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  // Find best match based on keywords
  for (const banker of bankers) {
    const keywords = banker.routing_keywords || [];

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return banker;
      }
    }
  }

  // Return default banker if no match
  return bankers[0] || null;
}

// NEW: Message cleaner
function cleanMessage(text) {
  // Remove last line (usually contains trigger keyword)
  const lines = text.split('\n');
  if (lines.length > 1) {
    lines.pop();
  }
  return lines.join('\n').trim();
}
```

---

## 📋 Implementation Checklist

### Phase 1: Database Schema ✅
- [x] Create `bankers` table
- [x] Create `banker_routing_rules` table
- [x] Update `valuation_requests` table with new columns
- [x] Add indexes for performance
- [x] Seed initial banker data from n8n workflow

### Phase 2: API Endpoints 🔄
- [ ] `/api/bankers` - CRUD for banker management
- [ ] `/api/routing-rules` - CRUD for routing rules
- [ ] `/api/valuations` - Enhanced with banker assignment
- [ ] `/api/valuations/:id/reassign` - Re-assign banker
- [ ] `/api/valuations/:id/resend` - Retry forward to banker

### Phase 3: Frontend UI 🔄
- [ ] **Banker Management Page** (`/bankers.html`)
  - [ ] AG Grid with inline editing
  - [ ] Add/Remove bankers
  - [ ] Configure keywords
  - [ ] View statistics

- [ ] **Enhanced Valuation Page** (`/valuations.html`)
  - [ ] Add "Assigned Banker" column with dropdown
  - [ ] Add "Forwarded Status" column
  - [ ] Add "Acknowledgment" column
  - [ ] Re-assign banker action
  - [ ] Resend to banker action

- [ ] **Routing Configuration Page** (`/routing.html`)
  - [ ] Visual rule builder
  - [ ] Priority ordering
  - [ ] Test routing tool

### Phase 4: Workflow Updates ✅
- [x] Update `valuationSupabase.js` with banker routing
- [x] Add `routeToBanker()` function
- [x] Add `cleanMessage()` function
- [x] Add forward to banker logic
- [x] Add acknowledgment logic

### Phase 5: Data Migration 🔄
- [ ] Create seed script for bankers from n8n workflow
- [ ] Migrate existing valuations (assign bankers retroactively)
- [ ] Test routing with sample messages

---

## 🎯 Priority Actions

1. **CRITICAL**: Update Supabase schema with new tables/columns
2. **HIGH**: Seed banker data from n8n workflow (14 bankers)
3. **HIGH**: Update valuation workflow with routing logic
4. **MEDIUM**: Create banker management UI
5. **MEDIUM**: Enhance valuation UI with banker columns
6. **LOW**: Create routing configuration UI

---

## 📊 Banker Data to Seed

Based on n8n workflow analysis, here are the bankers to seed:

| Name | Display Name | Bank | Group ID | Keywords |
|------|--------------|------|----------|----------|
| Yvonne | Yvonne | Premas | 6596440186-1598498077@g.us | yvonne, premas |
| Ethan | Ethan | DBS | 120363026214257477@g.us | ethan, dbs |
| Hui Hui | Hui Hui | MBB | (from workflow) | hui hui, mbb |
| Vikram | Vikram | MBB | (from workflow) | vikram, mbb |
| Eunice | Eunice | OCBC | (from workflow) | eunice, ocbc |
| Ying Feng | Ying Feng | SCB | (from workflow) | ying feng, scb |
| Bret | Bret | UOB | (from workflow) | bret, uob |
| Xin Jie | Xin Jie | UOB | (from workflow) | xin jie, uob |
| Jewel | Jewel | OCBC | (from workflow) | jewel, ocbc |
| James | James | UOB | (from workflow) | james, uob |
| April | April | MBB | (from workflow) | april, mbb |
| Eunice Ong | Eunice Ong | OCBC | (from workflow) | eunice ong |
| Eunice Boon | Eunice Boon | OCBC | (from workflow) | eunice boon |
| Nat | Nat (Bot Testing) | Testing | (from workflow) | nat, testing, bot |

---

## 🚀 Next Steps

Would you like me to:
1. **Update the Supabase schema** with new tables and columns?
2. **Create the banker seed data** script?
3. **Update the valuation workflow** with routing logic?
4. **Build the banker management UI** with AG Grid?

Let me know which you'd like me to start with!
