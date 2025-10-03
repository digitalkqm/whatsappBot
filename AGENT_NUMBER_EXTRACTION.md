# 🔢 Agent Number Extraction - From n8n Workflow

## ✅ Solution Found!

The n8n workflow contains a JavaScript function that **extracts and formats the agent number** directly from the template text.

**No separate lookup table needed!** The agent number in the template is already a **phone number** (or gets converted to one).

---

## 📋 Template Format

```
Valuation Request:

Address: Blk 123 Ang Mo Kio Ave 4
Size: 1200 sqft
Asking: $500,000
Salesperson Name: John Tan
Agent Number: 91234567       ← Can be with/without country code
Banker Name: Yvonne
```

**Agent Number formats accepted:**
- `91234567` → Converts to `6591234567`
- `+6591234567` → Converts to `6591234567`
- `6591234567` → Already formatted
- `+65 9123 4567` → Converts to `6591234567`

---

## 💻 Extraction Function (from n8n workflow)

```javascript
function extractAndFormatAgentNumber(line) {
    if (!line) return null;

    // Extract number from the line (after the colon)
    const parts = line.split(':');
    if (parts.length < 2) return null;

    let number = parts[1].trim();

    // Remove any non-digit characters except leading +
    number = number.replace(/[^\d+]/g, '');

    // If number starts with +, remove it
    if (number.startsWith('+')) {
        number = number.substring(1);
    }

    // If number doesn't start with 65, add 65 prefix (Singapore)
    if (number && !number.startsWith('65')) {
        number = '65' + number;
    }

    return number || null;
}
```

---

## 🔄 Complete Parsing Function

```javascript
function parseValuationTemplate(text) {
  // Check if it's a valuation request
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
    data.agent_phone_number = number || null; // Same as agent_number
    data.agent_whatsapp_id = number ? `${number}@c.us` : null;
  }

  // Remove last 3 lines (salesperson, agent number, banker) for cleaned message
  const cleanedLines = nonEmpty.slice(0, -3);
  data.cleaned_message = cleanedLines.join('\n');

  return data;
}
```

---

## 📤 Usage Examples

### **Example 1: Local number (no country code)**
```
Input: "Agent Number: 91234567"
Output:
  agent_number: "6591234567"
  agent_whatsapp_id: "6591234567@c.us"
```

### **Example 2: With + prefix**
```
Input: "Agent Number: +6591234567"
Output:
  agent_number: "6591234567"
  agent_whatsapp_id: "6591234567@c.us"
```

### **Example 3: With spaces**
```
Input: "Agent Number: +65 9123 4567"
Output:
  agent_number: "6591234567"
  agent_whatsapp_id: "6591234567@c.us"
```

### **Example 4: Already formatted**
```
Input: "Agent Number: 6591234567"
Output:
  agent_number: "6591234567"
  agent_whatsapp_id: "6591234567@c.us"
```

---

## 🗄️ Database Storage

Store both the original and formatted values:

```sql
-- In valuation_requests table
agent_number_raw TEXT,        -- Original from template: "91234567"
agent_number TEXT,            -- Formatted: "6591234567"
agent_phone_number TEXT,      -- Same as agent_number: "6591234567"
agent_whatsapp_id TEXT        -- WhatsApp format: "6591234567@c.us"
```

**Simplified** (what we actually need):
```sql
agent_number TEXT,            -- Store formatted: "6591234567"
agent_whatsapp_id TEXT        -- WhatsApp format: "6591234567@c.us"
```

---

## 📨 Sending to Agent

When banker replies, send to agent's WhatsApp:

```javascript
// After parsing and storing valuation request
const agentWhatsAppId = valuation.agent_whatsapp_id; // "6591234567@c.us"

// Send formatted reply
await sendWhatsAppMessage({
  jid: agentWhatsAppId,  // ← Use this for private message
  message: formattedReply
});
```

---

## ✅ Key Points

1. **No lookup table needed** - Agent number IS the phone number
2. **Auto-formatting** - Handles multiple input formats
3. **Singapore default** - Adds '65' prefix if missing
4. **Direct extraction** - Parse from template on-the-fly
5. **Store formatted value** - Save processed number for later use

---

## 🎯 Updated Workflow

### **Request Flow:**
```javascript
// 1. Parse template
const parsed = parseValuationTemplate(text);

// 2. Save to database
await supabase.from('valuation_requests').insert({
  address: parsed.address,
  size: parsed.size,
  asking: parsed.asking,
  salesperson_name: parsed.salesperson_name,
  agent_number: parsed.agent_number,           // "6591234567"
  agent_whatsapp_id: parsed.agent_whatsapp_id, // "6591234567@c.us"
  banker_name_requested: parsed.banker_name_requested
});
```

### **Reply Flow:**
```javascript
// 1. Banker replies, system looks up original request
const valuation = await getOriginalValuation(forward_message_id);

// 2. Format reply message
const replyMessage = `Address: ${valuation.address}
Size: ${valuation.size}
Asking: ${valuation.asking}
Valuation: ${bankerReplyText}`;

// 3. Send to requester group
await sendWhatsAppMessage({
  groupId: valuation.requester_group_id,
  message: replyMessage
});

// 4. Send to agent's private chat
await sendWhatsAppMessage({
  jid: valuation.agent_whatsapp_id, // ← Direct from database!
  message: replyMessage
});
```

---

## 📋 Summary

✅ **Agent number IN template = Phone number**
✅ **Auto-format on extraction** (add country code if missing)
✅ **No separate agents table needed**
✅ **Store formatted number + WhatsApp ID**
✅ **Use directly for messaging**

**No complex mapping required!** 🎉
