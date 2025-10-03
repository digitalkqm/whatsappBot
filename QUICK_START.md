# Quick Start Guide - Workflow Builder

## 🚀 Getting Started in 5 Minutes

### Step 1: Setup Database (One-time)

1. Open your Supabase project: https://app.supabase.com
2. Go to **SQL Editor**
3. Open `DATABASE_SCHEMA.md` from this project
4. Copy and run the SQL scripts
5. Verify 5 tables created: workflows, message_templates, contact_lists, workflow_executions, workflow_execution_logs

### Step 2: Start the Server

```bash
npm start
```

Open browser: **http://localhost:3000**

### Step 3: Create Your First Template

1. Click **"📝 Templates"** in navigation
2. Click **"+ Create Template"**
3. Fill in:
   - Name: `Welcome Message`
   - Category: `general`
   - Content:
     ```
     Hi {{name}},

     Welcome to Keyquest! We're here to help with all your property needs.

     Best regards,
     The Team
     ```
4. Click **"Save Template"**

✅ You now have a reusable template!

### Step 4: Import Contacts

**Option A: Manual Entry**
1. Click **"👥 Contacts"**
2. Click **"+ Create Contact List"**
3. Tab: **"Manual Entry"**
4. Add contacts:
   - Name: John Doe
   - Phone: 6512345678
   - Email: john@example.com
5. Click **"+ Add Contact"** for more
6. Click **"Create List"**

**Option B: CSV Upload**
1. Create CSV file:
   ```csv
   name,phone,email
   John Doe,6512345678,john@example.com
   Jane Smith,6587654321,jane@example.com
   ```
2. Click **"+ Create Contact List"**
3. Tab: **"CSV Upload"**
4. Drag & drop your CSV file
5. Preview appears - verify data
6. Click **"Import Contacts"**

**Option C: Google Sheets**
1. Share your Google Sheet with service account email
2. Click **"+ Create Contact List"**
3. Tab: **"Google Sheets"**
4. Paste Spreadsheet ID from URL
5. Enter Sheet Name (e.g., "Clients")
6. Click **"Sync from Google Sheets"**

✅ You now have a contact list!

---

## 📱 Using Templates and Contacts

### Current Usage (Manual API)

**Send a message using template:**
```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "jid": "6512345678@c.us",
    "message": "Hi John,\n\nWelcome to Keyquest! We'\''re here to help with all your property needs.\n\nBest regards,\nThe Team"
  }'
```

**Get template by ID:**
```bash
curl http://localhost:3000/api/templates/{template-id}
```

**Render template with data:**
```bash
curl -X POST http://localhost:3000/api/templates/{template-id}/preview \
  -H "Content-Type: application/json" \
  -d '{
    "sample_data": {
      "name": "John",
      "company": "Keyquest"
    }
  }'
```

**Get contact list:**
```bash
curl http://localhost:3000/api/contacts/{list-id}
```

### Future Usage (Visual Workflow Builder)

When workflow builder is ready:
1. Drag "Get Template" node → select your template
2. Drag "Get Contacts" node → select your list
3. Drag "Loop" node → iterate through contacts
4. Drag "Send Message" node → combine template + contact
5. Connect nodes and click "Run Workflow"

---

## 🎯 Common Tasks

### Task: Broadcast to All Contacts

**Current Method** (using existing Interest Rate workflow):
1. Create template with your message
2. Update Google Sheets with contact list
3. Send WhatsApp message with trigger: "keyquest mortgage team"
4. Workflow auto-broadcasts to all contacts

**Template Setup:**
```javascript
// In Google Sheets "Clients" tab:
Column E2: 0 (last processed index)
Column F2: Your message content
Column H2: Image URL (optional)
Columns A-B: Name and Phone list
```

### Task: Send Personalized Messages

1. **Create template** with variables:
   ```
   Dear {{name}},

   Your {{property_type}} at {{address}} is valued at {{valuation}}.

   Contact us for details.
   ```

2. **Get contacts** from list:
   ```bash
   curl http://localhost:3000/api/contacts/{list-id}
   ```

3. **For each contact**, render template:
   ```bash
   curl -X POST http://localhost:3000/api/templates/{id}/preview \
     -d '{"sample_data": {"name": "John", "property_type": "Condo", ...}}'
   ```

4. **Send via WhatsApp**:
   ```bash
   curl -X POST http://localhost:3000/send-message \
     -d '{"jid": "65xxxxx@c.us", "message": "<rendered message>"}'
   ```

### Task: Update Contact List

**Add contacts:**
```bash
curl -X POST http://localhost:3000/api/contacts/{list-id}/add \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      {"name": "New Contact", "phone": "6599999999", "email": "new@example.com"}
    ]
  }'
```

**Remove contacts:**
```bash
curl -X POST http://localhost:3000/api/contacts/{list-id}/remove \
  -H "Content-Type: application/json" \
  -d '{
    "phones": ["6599999999"]
  }'
```

### Task: Re-sync Google Sheets

```bash
curl -X POST http://localhost:3000/api/contacts/sync/google-sheets \
  -H "Content-Type: application/json" \
  -d '{
    "list_id": "{existing-list-id}",
    "spreadsheet_id": "your-spreadsheet-id",
    "sheet_name": "Clients",
    "range": "A2:D1000"
  }'
```

---

## 💡 Pro Tips

### Template Variables

**Best Practices:**
- Use lowercase with underscores: `{{first_name}}`
- Keep variable names short and descriptive
- Provide default values in your code
- Test with preview before sending

**Common Variables:**
```
{{name}} or {{first_name}}
{{phone}}
{{email}}
{{address}}
{{property_type}}
{{date}}
{{amount}}
{{rate}}
```

### Contact Management

**Phone Format:**
- Always include country code: `65xxxxxxxx`
- System auto-normalizes to this format
- Duplicates detected by phone number

**Organizing Lists:**
- Use tags: `["vip", "2024", "active"]`
- Descriptive names: "Q1 2024 VIP Clients"
- Keep descriptions updated
- Regular cleanup of inactive contacts

### Performance

**Batch Operations:**
- Process contacts in batches (10-20 at a time)
- Add delays between messages (7-10 seconds)
- Use human behavior settings from existing workflows

**Google Sheets:**
- Limit range to active data (not A:Z)
- Use specific sheet names
- Monitor sync frequency

---

## 🆘 Troubleshooting

### "Failed to create template"
- Check all required fields filled
- Verify variable syntax: `{{name}}` not `{name}`
- Ensure name is unique
- Check image URL is valid

### "CSV import failed"
- Verify CSV format (comma-separated)
- Check headers in first row
- Remove special characters
- Save as UTF-8 encoding

### "Google Sheets sync error"
- Confirm spreadsheet ID is correct
- Verify service account has access
- Check sheet name exists
- Validate range format (A2:D1000)

### "Template variables not replacing"
- Match variable names exactly
- Check data structure in preview
- Verify {{syntax}} is correct
- Test with preview endpoint first

---

## 📚 Next Steps

1. ✅ **Read Full Guide**: `WORKFLOW_BUILDER_GUIDE.md`
2. ✅ **Check Implementation**: `IMPLEMENTATION_SUMMARY.md`
3. ✅ **Setup Database**: `DATABASE_SCHEMA.md`
4. ✅ **Explore API**: Try the curl examples above
5. ✅ **Build Workflows**: Create templates and contact lists

---

## 🔗 Quick Links

- Main Dashboard: http://localhost:3000
- Template Manager: http://localhost:3000/templates.html
- Contact Manager: http://localhost:3000/contacts.html
- Health Check: http://localhost:3000/health
- API Status: http://localhost:3000/api/status

---

**Need Help?**
- Full Documentation: `WORKFLOW_BUILDER_GUIDE.md`
- API Reference: See "API Reference" section in guide
- Database Setup: `DATABASE_SCHEMA.md`
- Environment Config: `ENVIRONMENT_VARIABLES.md`

---

*Happy Automating! 🚀*
