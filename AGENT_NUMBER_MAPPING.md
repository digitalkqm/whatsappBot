# 🔢 Agent Number to Phone Number Mapping

## Problem

The template contains `Agent Number: AG888` but we need to send WhatsApp messages to the agent's phone number.

**Question**: How do we convert `AG888` → Phone number?

---

## Solution Options

### **Option 1: Agent Master Table** (Recommended)

Create a lookup table for agents:

```sql
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_number TEXT NOT NULL UNIQUE, -- e.g., "AG888"
  name TEXT NOT NULL, -- e.g., "John Tan"
  phone_number TEXT NOT NULL, -- e.g., "6591234567"
  whatsapp_id TEXT, -- e.g., "6591234567@c.us"

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agents_number ON agents(agent_number);
CREATE INDEX idx_agents_phone ON agents(phone_number);
```

**Usage:**
```javascript
// Lookup agent phone number
const { data: agent } = await supabase
  .from('agents')
  .select('phone_number, whatsapp_id')
  .eq('agent_number', 'AG888')
  .single();

const agentWhatsAppId = agent.whatsapp_id || `${agent.phone_number}@c.us`;
// Result: "6591234567@c.us"
```

**Pros:**
✅ Clean separation of concerns
✅ Easy to manage agent data
✅ Can add more agent fields (email, team, etc.)
✅ Can deactivate agents

**Cons:**
❌ Requires initial data seeding
❌ One more table to maintain

---

### **Option 2: Stored in Valuation Template**

Add phone number to the template itself:

```
Valuation Request:

Address: Blk 123 Ang Mo Kio Ave 4
Size: 1200 sqft
Asking: $500,000
Salesperson Name: John Tan
Agent Number: AG888
Agent Phone: 6591234567  ← NEW FIELD
Banker Name: Yvonne
```

**Pros:**
✅ No lookup needed
✅ Self-contained data

**Cons:**
❌ Longer template
❌ More fields to fill
❌ Prone to typos

---

### **Option 3: Pattern Matching / Calculation**

If agent numbers follow a predictable pattern:

```javascript
function agentNumberToPhone(agentNumber) {
  // Example: AG888 → 6598000888
  const number = agentNumber.replace('AG', '');
  return `6598${number.padStart(6, '0')}`;
}
```

**Pros:**
✅ No storage needed
✅ Automatic conversion

**Cons:**
❌ Only works if pattern exists
❌ Not flexible

---

### **Option 4: Use Salesperson Name as Lookup**

Match salesperson name with agent phone:

```sql
CREATE TABLE IF NOT EXISTS salespersons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  agent_number TEXT,
  phone_number TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_salespersons_name ON salespersons(name);
```

**Lookup:**
```javascript
const { data: salesperson } = await supabase
  .from('salespersons')
  .select('phone_number')
  .eq('name', 'John Tan')
  .single();
```

**Pros:**
✅ Natural lookup by name

**Cons:**
❌ Names can be duplicated
❌ Typos in names break lookup

---

## ✅ Recommended Approach

**Use Option 1: Agent Master Table**

### **Implementation:**

1. **Create agents table:**
```sql
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  whatsapp_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

2. **Seed initial agents:**
```sql
INSERT INTO agents (agent_number, name, phone_number, whatsapp_id)
VALUES
  ('AG001', 'Yvonne', '6591111111', '6591111111@c.us'),
  ('AG002', 'Ethan', '6592222222', '6592222222@c.us'),
  ('AG888', 'John Tan', '6591234567', '6591234567@c.us')
ON CONFLICT (agent_number) DO NOTHING;
```

3. **Lookup function in workflow:**
```javascript
async function getAgentWhatsAppId(supabase, agentNumber) {
  const { data: agent, error } = await supabase
    .from('agents')
    .select('phone_number, whatsapp_id')
    .eq('agent_number', agentNumber)
    .eq('is_active', true)
    .single();

  if (error || !agent) {
    console.warn(`Agent ${agentNumber} not found in database`);
    return null;
  }

  return agent.whatsapp_id || `${agent.phone_number}@c.us`;
}
```

4. **Usage in reply workflow:**
```javascript
// After banker replies
const agentWhatsAppId = await getAgentWhatsAppId(supabase, valuation.agent_number);

if (agentWhatsAppId) {
  // Send to agent's private chat
  await sendWhatsAppMessage({
    jid: agentWhatsAppId, // e.g., "6591234567@c.us"
    message: formattedReply
  });
}
```

---

## 📋 Migration Plan

1. ✅ Create `agents` table in Supabase
2. ✅ Seed initial agent data (from existing records)
3. ✅ Update reply workflow to lookup agent phone
4. ✅ Create admin UI to manage agents
5. ✅ Add validation to check agent exists when request comes in

---

## ❓ Questions to Confirm

1. **Do you have a list of agent numbers → phone numbers?**
2. **Should we create the agents table?**
3. **Or is there a different way to map AG### to phone numbers?**

Please provide guidance on how to handle the agent number mapping! 🔢
