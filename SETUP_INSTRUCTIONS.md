# 🚀 Quick Setup Instructions

## ✅ What's Ready

I've prepared everything you need to update your Supabase database and implement the banker routing system.

---

## 📋 Step-by-Step Guide

### **Step 1: Update Supabase Database (5 minutes)**

1. **Open Supabase Dashboard**
   - Go to https://supabase.com
   - Login and select your WhatsApp Bot project
   - Click **SQL Editor** in left sidebar

2. **Run the Schema Update**
   - Click **New Query**
   - Open file: `/database/supabase_schema_update.sql`
   - Copy ALL contents and paste into SQL Editor
   - Click **Run** (or Ctrl+Enter)

3. **Verify Success**
   - You should see: `Success. No rows returned`
   - Run this query to verify bankers were created:
   ```sql
   SELECT name, bank_name, whatsapp_group_id FROM bankers ORDER BY priority DESC;
   ```
   - You should see **14 bankers** with their WhatsApp group IDs

---

## ✅ What Got Created in Supabase

### **New Tables:**
1. ✅ `bankers` - 14 bankers with their WhatsApp groups
2. ✅ `banker_routing_rules` - Keyword routing configuration

### **Updated Tables:**
3. ✅ `valuation_requests` - Added 9 new columns:
   - `banker_id` - Assigned banker
   - `banker_name` - Cached banker name
   - `target_group_id` - Banker's WhatsApp group
   - `cleaned_message` - Processed message
   - `forwarded_to_banker` - Tracking
   - `forwarded_at` - Timestamp
   - `acknowledgment_sent` - Tracking
   - `acknowledgment_message_id` - WhatsApp message ID
   - `acknowledgment_text` - Message sent

### **New Functions:**
4. ✅ `route_to_banker(text)` - Auto-route messages to bankers
5. ✅ `increment_banker_valuation_count()` - Auto-track stats

### **New Views:**
6. ✅ `vw_recent_valuations` - Enhanced with banker info
7. ✅ `vw_banker_performance` - Banker statistics

---

## 📊 Banker Data Seeded

All 14 bankers from your n8n workflow are ready:

| Banker | Bank | WhatsApp Group ID | Keywords |
|--------|------|-------------------|----------|
| Yvonne | Premas | 6596440186-1598498077@g.us | yvonne, premas |
| Ethan | DBS | 120363026214257477@g.us | ethan, dbs |
| Hui Hui | MBB | 120363156244588807@g.us | hui hui, mbb |
| Vikram | MBB | 120363216496983099@g.us | vikram |
| April | MBB | 6596440186-1532139636@g.us | april |
| Eunice | OCBC | 120363399758119890@g.us | eunice |
| Jewel | OCBC | 120363410164822147@g.us | jewel |
| Eunice Ong | OCBC | 6596440186-1614324984@g.us | eunice ong |
| Eunice Boon | OCBC | 6596440186-1614324984@g.us | eunice boon |
| Ying Feng | SCB | 6596440186-1533216750@g.us | ying feng, scb |
| Bret | UOB | 6596440186-1587618823@g.us | bret |
| Xin Jie | UOB | 120363416304945643@g.us | xin jie |
| James | UOB | 120363215516608216@g.us | james |
| Nat (Testing) | Testing | 120363026214257477@g.us | nat, bot, testing |

---

## 🧪 Test the Routing Function

After running the schema update, test the routing:

```sql
-- Test routing to Yvonne
SELECT
  b.name,
  b.bank_name,
  b.whatsapp_group_id
FROM bankers b
WHERE b.id = route_to_banker('Please contact yvonne for this valuation');

-- Expected: Yvonne

-- Test routing to Ethan
SELECT
  b.name,
  b.bank_name
FROM bankers b
WHERE b.id = route_to_banker('Can ethan help with this property?');

-- Expected: Ethan

-- Test routing to MBB
SELECT
  b.name,
  b.bank_name
FROM bankers b
WHERE b.id = route_to_banker('Need help from MBB team');

-- Expected: Hui Hui (highest priority MBB banker)
```

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `/database/supabase_schema_update.sql` | ✅ Main schema update (run this in Supabase) |
| `/database/update_group_ids.sql` | ℹ️ Auto-generated group ID updates (already included) |
| `/scripts/extract-group-ids.js` | ✅ Helper script (already ran successfully) |
| `/VALUATION_WORKFLOW_ANALYSIS.md` | 📖 Detailed analysis of gaps |
| `/IMPLEMENTATION_GUIDE.md` | 📖 Full implementation guide |
| `/SETUP_INSTRUCTIONS.md` | 📖 This file - quick setup |

---

## 🎯 Next Steps (After Database Update)

Once you confirm the database update worked, I'll create:

### Phase 2: Update Workflow Code
- ✅ Enhanced `valuationSupabase.js` with routing logic
- ✅ Forward messages to banker's WhatsApp group
- ✅ Send acknowledgments to requesters

### Phase 3: Create API Endpoints
- `/api/bankers` - Manage bankers (CRUD)
- `/api/valuations` - Enhanced with banker assignment
- `/api/routing` - Test routing logic

### Phase 4: Create Frontend UI
- `/public/bankers.html` - Banker management (Excel-like grid)
- `/public/valuations.html` - Enhanced with banker columns
- Navigation links

---

## ❓ Troubleshooting

### ❌ Error: "relation already exists"
**Solution**: Tables already created. Safe to ignore or drop and recreate:
```sql
DROP TABLE IF EXISTS banker_routing_rules CASCADE;
DROP TABLE IF EXISTS bankers CASCADE;
-- Then re-run the schema update
```

### ❌ Error: "column already exists"
**Solution**: Columns already added. Safe to ignore.

### ❌ No bankers showing
**Solution**: Check if INSERT succeeded:
```sql
SELECT COUNT(*) FROM bankers;
-- Should show 14
```

If zero, manually run the INSERT statements from the schema file.

---

## ✅ Ready to Proceed?

**Once you've run the schema update in Supabase**, let me know and I'll:
1. Update the valuation workflow with routing logic
2. Create the API endpoints
3. Build the Excel-like UI for bankers and valuations

**Just confirm**: "Schema updated successfully" and I'll continue with the next phase! 🚀
