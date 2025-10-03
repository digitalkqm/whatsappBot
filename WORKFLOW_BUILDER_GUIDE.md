# WhatsApp Bot Workflow Builder - User Guide

## 🎯 Overview

The Workflow Builder system enables you to create, manage, and execute custom WhatsApp automation workflows without writing code. This guide covers all features of the Template Manager and Contact Manager.

## 📝 Template Manager

### What are Templates?

Templates are reusable message patterns with dynamic variable placeholders. They allow you to:
- Create consistent messaging across workflows
- Personalize messages with dynamic content
- Store and reuse common messages
- Organize messages by category

### Creating Templates

1. **Navigate to Templates**
   - Click "📝 Templates" in the dashboard navigation
   - Click "+ Create Template" button

2. **Template Properties**
   - **Name**: Descriptive name for the template
   - **Category**: Organize templates (interest_rate, valuation, marketing, etc.)
   - **Content**: Message body with variable placeholders
   - **Image URL** (optional): Attach images to messages

3. **Using Variables**
   ```
   Syntax: {{variable_name}}

   Example:
   Dear {{name}},

   Latest interest rates:
   {{rates}}

   Best regards,
   Keyquest Team
   ```

4. **Variable Guidelines**
   - Use lowercase names with underscores
   - Variables are automatically extracted from content
   - Preview shows how variables will be replaced
   - Common variables: `name`, `phone`, `email`, `address`, `rates`

### Managing Templates

**View Templates**
- Grid view shows all templates
- Click any template card to view details
- Search templates by name or content
- Filter by category

**Edit Templates**
- Click ✏️ (edit) icon on template card
- Or click "Edit" in detail view
- Changes are saved immediately

**Duplicate Templates**
- Click 📋 (duplicate) icon
- Creates a copy with "(Copy)" suffix
- Useful for creating variations

**Delete Templates**
- Click 🗑️ (delete) icon
- Confirmation required
- Cannot be undone

### Template Categories

- **general**: All-purpose messages
- **interest_rate**: Rate updates and announcements
- **valuation**: Property valuation related
- **marketing**: Promotional messages
- **custom**: User-defined categories

## 👥 Contact Manager

### What are Contact Lists?

Contact lists store groups of contacts for targeted messaging. Features include:
- Import from multiple sources
- Organize with tags
- Track statistics
- Sync with Google Sheets

### Creating Contact Lists

#### Method 1: Manual Entry

1. Click "+ Create Contact List"
2. Select "Manual Entry" tab
3. Fill in:
   - List name
   - Description (optional)
   - Contacts (name, phone, email)
4. Click "+ Add Contact" for more rows
5. Click "Create List"

**Phone Number Format:**
- Singapore: `65xxxxxxxx` (8 digits with country code)
- International: Include country code
- System auto-formats phone numbers

#### Method 2: CSV Upload

1. Select "CSV Upload" tab
2. Drag & drop CSV file or click to browse
3. CSV format:
   ```csv
   name,phone,email
   John Doe,6512345678,john@example.com
   Jane Smith,6587654321,jane@example.com
   ```
4. Preview shows first 5 rows
5. Click "Import Contacts"

**CSV Requirements:**
- First row must be headers
- Phone column is required
- Name and email are optional
- Additional columns become custom fields

#### Method 3: Google Sheets Sync

1. Select "Google Sheets" tab
2. Fill in:
   - **Spreadsheet ID**: From Google Sheets URL
     ```
     https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
     ```
   - **Sheet Name**: Default is "Clients"
   - **Range**: Default is "A2:D1000"
3. Expected columns: Name, Phone, Email, Additional Info
4. Click "Sync from Google Sheets"

**Google Sheets Setup:**
- Service account must have access to sheet
- Share sheet with service account email
- Grant "Editor" permissions
- See `ENVIRONMENT_VARIABLES.md` for credentials setup

### Managing Contact Lists

**View Contact Lists**
- Card view shows all lists
- Statistics: Total contacts, last updated
- Tags for organization
- Click card to view details

**View Details**
- See all contacts in table format
- Shows first 50 contacts
- Export capabilities (future feature)
- Statistics and metadata

**Delete Lists**
- Click "Delete List" in detail view
- Confirmation required
- Cannot be undone

### Contact List Sources

- **manual**: Hand-entered contacts
- **csv_import**: Imported from CSV files
- **google_sheets**: Synced from Google Sheets
- **whatsapp_groups**: From WhatsApp group membership

## 🔐 Security Best Practices

### Template Security

1. **Variable Validation**
   - Always validate variable data before sending
   - Avoid sensitive information in templates
   - Use generic placeholders

2. **Image URLs**
   - Only use trusted image sources
   - Verify URLs are accessible
   - Consider using CDN for reliability

### Contact Security

1. **Data Privacy**
   - Only collect necessary contact information
   - Follow PDPA/GDPR guidelines
   - Secure storage in Supabase

2. **Phone Number Validation**
   - System validates format
   - Checks for duplicates
   - Normalizes numbers automatically

3. **Access Control**
   - Protect Supabase credentials
   - Limit API access
   - Monitor usage logs

## 📊 Best Practices

### Template Best Practices

1. **Naming Conventions**
   - Use descriptive names: "Interest Rate Update - March 2024"
   - Include version numbers for iterations
   - Group related templates with prefixes

2. **Content Guidelines**
   - Keep messages concise (under 1000 characters)
   - Use clear, professional language
   - Test with sample data before deployment
   - Include opt-out information for marketing

3. **Variable Usage**
   - Limit to 5-7 variables per template
   - Use consistent naming across templates
   - Document custom variables
   - Provide default values

### Contact Management Best Practices

1. **List Organization**
   - Use descriptive list names
   - Add tags for easy filtering
   - Keep descriptions updated
   - Regular cleanup of outdated contacts

2. **Data Quality**
   - Verify phone numbers before import
   - Remove duplicates
   - Keep contact information current
   - Tag contacts by engagement level

3. **Sync Strategy**
   - Schedule regular Google Sheets syncs
   - Test with small batches first
   - Monitor for errors
   - Keep backup of contact lists

## 🚀 Quick Start Examples

### Example 1: Interest Rate Broadcast

**Step 1: Create Template**
```
Name: Monthly Rate Update
Category: interest_rate
Content:
Hi {{name}},

Our latest interest rates for {{month}}:
- 3-year fixed: {{rate_3yr}}%
- 5-year fixed: {{rate_5yr}}%

Reply for personalized consultation.

Best,
Keyquest Team
```

**Step 2: Create Contact List**
- Method: Google Sheets sync
- Spreadsheet: VIP Clients database
- Auto-sync: Every hour

**Step 3: Use in Workflow**
- (Future: Workflow builder will link template + contacts)

### Example 2: Valuation Response

**Step 1: Create Template**
```
Name: Valuation Acknowledgment
Category: valuation
Content:
Thanks {{name}}!

We've received your valuation request for:
📍 {{address}}

Our team will review and get back to you within 24 hours.

Questions? Reply here anytime.
```

**Step 2: Trigger**
- Set workflow to use template when "valuation request" detected
- Auto-populate variables from message parsing

## 🆘 Troubleshooting

### Templates Not Saving

**Problem**: "Failed to save template" error

**Solutions**:
1. Check template name is not empty
2. Verify content has valid variable syntax
3. Check image URL is accessible
4. Refresh page and try again

### CSV Import Failing

**Problem**: Contacts not importing from CSV

**Solutions**:
1. Verify CSV format (comma-separated)
2. Check first row has headers
3. Ensure phone numbers are valid
4. Remove special characters from data
5. Check file encoding is UTF-8

### Google Sheets Sync Error

**Problem**: "Failed to sync from Google Sheets"

**Solutions**:
1. Verify spreadsheet ID is correct
2. Check service account has access
3. Confirm sheet name exists
4. Verify range is valid (e.g., A2:D1000)
5. Check GOOGLE_SHEETS_CREDENTIALS in .env

### Variable Not Replacing

**Problem**: {{variable}} appears in sent message

**Solutions**:
1. Check variable name matches data key
2. Verify data is provided in workflow
3. Use exact syntax: {{name}} not {{ name }}
4. Preview template before sending

## 📚 API Reference

For developers integrating with the workflow builder:

### Template API

```javascript
// Create template
POST /api/templates/create
Body: {
  name: "Template Name",
  category: "general",
  content: "Message with {{variables}}",
  image_url: "https://..."
}

// List templates
GET /api/templates/list?category=general&search=keyword

// Get template
GET /api/templates/:id

// Update template
PUT /api/templates/:id/update
Body: { /* fields to update */ }

// Delete template
DELETE /api/templates/:id/delete

// Preview template
POST /api/templates/:id/preview
Body: {
  sample_data: {
    name: "John",
    variable: "value"
  }
}
```

### Contact API

```javascript
// Create contact list
POST /api/contacts/create
Body: {
  name: "List Name",
  description: "Description",
  contacts: [
    { name: "John", phone: "6512345678", email: "john@example.com" }
  ],
  source: "manual",
  tags: ["tag1", "tag2"]
}

// List contact lists
GET /api/contacts/list?source=manual&tag=vip

// Get contact list
GET /api/contacts/:id

// Import from CSV
POST /api/contacts/import/csv
Body: {
  csv_data: "name,phone,email\n...",
  list_name: "Imported Contacts",
  mapping: { name: "name", phone: "phone", email: "email" }
}

// Sync from Google Sheets
POST /api/contacts/sync/google-sheets
Body: {
  spreadsheet_id: "...",
  sheet_name: "Clients",
  range: "A2:D1000"
}

// Get WhatsApp groups
GET /api/contacts/groups/whatsapp
```

## 🎓 Learning Resources

1. **Video Tutorials** (Coming Soon)
   - Creating your first template
   - Importing contacts from CSV
   - Setting up Google Sheets sync

2. **Sample Templates**
   - Check `examples/` directory for pre-built templates
   - Modify to suit your needs

3. **Community**
   - GitHub Discussions for questions
   - Share your templates and workflows

## 📅 Roadmap

Upcoming features:
- ✨ Visual workflow builder with drag-drop
- 🔄 Automated workflow scheduling
- 📊 Analytics and reporting
- 🌐 Multi-language template support
- 🔗 CRM integrations
- 📱 WhatsApp Business API support

---

**Need Help?**
- Documentation: `README.md`
- Database Setup: `DATABASE_SCHEMA.md`
- Environment Config: `ENVIRONMENT_VARIABLES.md`
- Issues: https://github.com/your-repo/issues
