# 🚀 Step-by-Step Implementation Guide

## Overview
This guide walks you through updating your Supabase database and implementing the banker routing system.

---

## 📋 Step 1: Update Supabase Database Schema

### 1.1 Open Supabase Dashboard
1. Go to https://supabase.com
2. Login to your account
3. Select your WhatsApp Bot project
4. Click **SQL Editor** in the left sidebar

### 1.2 Run Schema Updates
1. Click **New Query**
2. Copy the contents of `/database/supabase_schema_update.sql`
3. Paste into the SQL editor
4. Click **Run** (or press Ctrl+Enter)

**Expected Result**:
```
✅ 3 tables created/updated
✅ 14 bankers inserted
✅ 2 views created
✅ 3 functions created
```

### 1.3 Extract WhatsApp Group IDs from n8n Workflow

You need to find the actual WhatsApp group IDs from your n8n workflow JSON file.

**Method 1: Search in JSON file**
```bash
# Search for group IDs
grep -o '"groupId": "[^"]*"' "json/WhatsApp Valuation.json" | sort -u
```

**Method 2: Manual extraction**
1. Open `json/WhatsApp Valuation.json` in a text editor
2. Search for "Send to MBB Hui Hui" (and other banker names)
3. Find the `groupId` field in those nodes
4. Note down the group IDs

Example from workflow:
```json
{
  "name": "Send to MBB Hui Hui",
  "parameters": {
    "bodyParametersUi": {
      "parameter": [
        {
          "name": "groupId",
          "value": "120363299999999999@g.us"  // ← THIS IS THE GROUP ID
        }
      ]
    }
  }
}
```

### 1.4 Update Banker Group IDs

Once you have the group IDs, update the bankers table:

1. Go back to **SQL Editor** in Supabase
2. Run these UPDATE queries (replace with your actual group IDs):

```sql
-- Update MBB Hui Hui
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Hui Hui';

-- Update MBB Vikram
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Vikram';

-- Update MBB April
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'April';

-- Update OCBC Eunice
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Eunice';

-- Update OCBC Jewel
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Jewel';

-- Update OCBC Eunice Ong
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Eunice Ong';

-- Update OCBC Eunice Boon
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Eunice Boon';

-- Update SCB Ying Feng
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Ying Feng';

-- Update UOB Bret
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Bret';

-- Update UOB Xin Jie
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Xin Jie';

-- Update UOB James
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'James';

-- Update Bot Testing
UPDATE bankers
SET whatsapp_group_id = 'YOUR_ACTUAL_GROUP_ID_HERE'
WHERE name = 'Nat';
```

### 1.5 Verify Database Setup

Run this query to check bankers were created correctly:

```sql
SELECT
  name,
  bank_name,
  whatsapp_group_id,
  routing_keywords,
  is_active
FROM bankers
ORDER BY priority DESC;
```

**Expected Result**: Should show 14 bankers with their details.

---

## 📋 Step 2: Extract Group IDs Helper Script

I'll create a script to help you extract the group IDs automatically.

Run this in your terminal:

```bash
node scripts/extract-group-ids.js
```

This will output all the group IDs you need to update.

---

## 📋 Step 3: Update Workflow Code

The valuation workflow needs to be updated to use the new banker routing.

**File to update**: `/workflows/valuationSupabase.js`

Key changes:
1. Route incoming messages to bankers
2. Forward to banker's WhatsApp group
3. Send acknowledgment to requester
4. Track forwarding status

---

## 📋 Step 4: Create API Endpoints

API endpoints for the frontend to manage bankers and valuations.

**Files to create**:
- `/api/bankerAPI.js` - CRUD for bankers
- `/api/valuationAPI.js` - Enhanced valuations with banker assignment

---

## 📋 Step 5: Create Frontend UI

Build the Excel-like interface for managing bankers and valuations.

**Pages to create**:
1. `/public/bankers.html` - Banker management
2. `/public/valuations.html` - Enhanced valuation grid (update existing)

---

## 🎯 Quick Start Checklist

Use this checklist to track your progress:

### Database Setup
- [ ] Run `/database/supabase_schema_update.sql` in Supabase SQL Editor
- [ ] Verify 14 bankers were created
- [ ] Extract WhatsApp group IDs from n8n JSON
- [ ] Update all banker group IDs
- [ ] Test `route_to_banker()` function with sample text

### Code Updates
- [ ] Run `node scripts/extract-group-ids.js` to get group IDs
- [ ] Update valuation workflow with routing logic
- [ ] Create banker API endpoints
- [ ] Create valuation API endpoints
- [ ] Test API endpoints with Postman/curl

### Frontend UI
- [ ] Create banker management page (`/bankers.html`)
- [ ] Update valuation page with banker columns
- [ ] Add navigation links
- [ ] Test inline editing
- [ ] Test banker assignment

### Testing
- [ ] Send test valuation request
- [ ] Verify banker routing works
- [ ] Verify message forwarded to banker group
- [ ] Verify acknowledgment sent to requester
- [ ] Check database records are correct

---

## ❓ Troubleshooting

### Issue: Bankers not inserted
**Solution**: Check for unique constraint errors. Run:
```sql
SELECT * FROM bankers;
```
If empty, re-run the INSERT statements.

### Issue: Group IDs not found
**Solution**:
1. Open `json/WhatsApp Valuation.json` in VS Code
2. Search for "Send to" to find all send nodes
3. Look for `"name": "groupId"` fields
4. Copy the value after it

### Issue: Routing not working
**Solution**: Test the routing function:
```sql
SELECT route_to_banker('I need a valuation please contact yvonne');
-- Should return Yvonne's banker ID

SELECT route_to_banker('Can ethan help with this property?');
-- Should return Ethan's banker ID
```

---

## 📞 Next Steps After Setup

Once database is updated:
1. I'll create the group ID extraction script
2. I'll update the valuation workflow
3. I'll create the API endpoints
4. I'll build the frontend UI

**Ready to continue?** Let me know when you've completed Step 1 (Database Setup) and I'll proceed with the next files!
