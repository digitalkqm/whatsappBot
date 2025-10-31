# Contact Manager User Guide

## Overview
The Contact Manager provides a comprehensive interface for managing WhatsApp broadcast contacts with upload, display, edit, delete, and broadcast messaging capabilities.

## Accessing the Contact Manager
Navigate to: `http://your-domain/contacts.html`

---

## Features

### 1. Contact Upload Methods

#### A. Manual Entry
- Add contacts one-by-one through the web interface
- Fields available:
  - **Name** (optional)
  - **Phone** (required) - Format: `65XXXXXXXX`
  - **Email** (optional)
  - **Tier** (Standard, Premium, VIP)

**Steps:**
1. Click "+ Create Contact List"
2. Select "Manual Entry" tab
3. Enter list name and description
4. Add contacts using the form
5. Click "Add Contact" to add more rows
6. Submit the form

#### B. CSV Upload (Recommended for Bulk Import)
- Upload contacts via CSV file
- Supports drag-and-drop or file browse

**CSV Format:**
```csv
name,phone,email,tier
John Tan,6591234567,john@example.com,VIP
Mary Lee,6598765432,mary@example.com,Premium
David Wong,6512345678,david@example.com,Standard
```

**Requirements:**
- **First row MUST be headers**: `name,phone,email,tier`
- **phone** is REQUIRED (no spaces, no dashes)
- **name**, **email**, **tier** are optional
- **tier** values: VIP, Premium, or Standard (default: Standard)

**Steps:**
1. Click "📥 Download CSV Template" to get the correct format
2. Fill in your contacts following the template
3. Click "+ Create Contact List"
4. Select "CSV Upload" tab
5. Drag & drop or click to upload your CSV file
6. Preview will show first 5 rows
7. Enter list name and submit

#### C. Google Sheets Sync
- Sync contacts directly from Google Sheets
- One-time sync (not live connection)

**Steps:**
1. Click "+ Create Contact List"
2. Select "Google Sheets" tab
3. Enter Spreadsheet ID from Google Sheets URL
4. Enter Sheet Name (default: "Clients")
5. Enter Range (default: "A2:D1000")
6. Submit to sync

---

### 2. Contact Management

#### View All Contacts
- Table view showing all contacts with:
  - Name
  - Phone number
  - Email
  - Tier (VIP/Premium/Standard)
  - Contact list name
  - Action buttons

#### Search & Filter
- **Search Box**: Search by name, phone, or email
- **Tier Filter**: Filter by VIP, Premium, or Standard
- **Pagination**: 50 contacts per page

#### Edit Contact
1. Click the ✏️ (Edit) button next to any contact
2. Update the information
3. Click "Save Changes"

**Editable Fields:**
- Name
- Phone (format: 65XXXXXXXX)
- Email
- Tier

#### Delete Contact
1. Click the 🗑️ (Delete) button next to any contact
2. Confirm deletion
3. Contact is permanently removed

---

### 3. Broadcast Interest Rate Messages

#### Selection Process
1. **Select Individual Contacts**: Check the box next to each contact
2. **Select All**: Click the checkbox in the table header
3. Selected count appears: "X selected"

#### Sending Broadcast
1. Select contacts using checkboxes
2. Click "📢 Broadcast Interest Rate Message" button
3. Configure broadcast:
   - **Message**: Enter your interest rate update
   - **Personalization**: Use `{name}` to insert contact names
   - **Image URL** (optional): Add image for visual appeal
   - **Batch Size**: Number of messages per batch (default: 10)
   - **Delay Between Messages**: Seconds between each message (default: 7)
4. Click "Start Broadcast"

**Example Message:**
```
Dear {name},

We are pleased to inform you that our interest rates have been updated:

• Home Loan: 2.5% p.a.
• Car Loan: 3.2% p.a.
• Personal Loan: 4.8% p.a.

Contact us today for more details!
```

**Best Practices:**
- Keep batch size at 10 to avoid WhatsApp restrictions
- Use 7-second delay to appear more human-like
- Personalize messages with `{name}` placeholder
- Include relevant images for better engagement

---

### 4. Bulk Operations

#### Delete Multiple Contacts
1. Select contacts using checkboxes
2. Click "🗑️ Delete Selected" button
3. Confirm deletion
4. All selected contacts are removed

**Warning**: Bulk deletion is permanent and cannot be undone.

---

## CSV Template Details

### Correct CSV Format

**Download the template** by clicking "📥 Download CSV Template" button.

**Template Structure:**
```csv
name,phone,email,tier
John Tan,6591234567,john@example.com,VIP
Mary Lee,6598765432,mary@example.com,Premium
David Wong,6512345678,david@example.com,Standard
Alice Lim,6587654321,alice@example.com,VIP
Bob Chen,6598761234,,Premium
```

### Field Specifications

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| `name` | No | Text | Contact's full name |
| `phone` | **YES** | 65XXXXXXXX | Singapore number, no spaces/dashes |
| `email` | No | email@domain.com | Valid email format |
| `tier` | No | VIP / Premium / Standard | Defaults to Standard if blank |

### Common CSV Errors to Avoid

❌ **Wrong:**
```csv
Name,Phone,Email,Tier  ← Different headers
John Tan,+65 9123 4567,john@example.com,VIP  ← Spaces in phone
Mary Lee,91234567,mary@example.com,Premium  ← Missing country code
```

✅ **Correct:**
```csv
name,phone,email,tier
John Tan,6591234567,john@example.com,VIP
Mary Lee,6598765432,mary@example.com,Premium
```

### Phone Number Format Rules

✅ **Correct Formats:**
- `6591234567` (Singapore mobile)
- `6587654321` (Singapore mobile)
- `6563334444` (Singapore landline)

❌ **Incorrect Formats:**
- `+65 9123 4567` (has spaces and +)
- `9123-4567` (has dashes)
- `91234567` (missing country code)
- `+6591234567` (has + symbol)

---

## Tier System

### What are Tiers?

Tiers help you categorize and manage contacts based on their importance or relationship level.

| Tier | Badge Color | Use Case |
|------|-------------|----------|
| **VIP** | Gold/Yellow | High-value clients, priority contacts |
| **Premium** | Blue | Regular clients, important contacts |
| **Standard** | Gray | General contacts, new leads |

### Benefits of Using Tiers

1. **Filtering**: Quickly filter and view contacts by tier
2. **Targeted Broadcasts**: Select only VIP clients for exclusive offers
3. **Organization**: Better contact management and segmentation
4. **Analytics**: Track engagement by customer tier

---

## API Endpoints Used

The frontend connects to these backend API endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/broadcast-contacts` | GET | Load all contacts across all lists |
| `/api/broadcast-contacts/create-list` | POST | Create contact list with individual contacts |
| `/api/broadcast-contacts/import-csv` | POST | Import contacts from CSV |
| `/api/contacts/sync/google-sheets` | POST | Sync from Google Sheets |
| `/api/broadcast-contacts/:id` | PUT | Update single contact |
| `/api/broadcast-contacts/:id` | GET | Get single contact details |
| `/api/broadcast-contacts/:id` | DELETE | Delete single contact |
| `/api/broadcast-contacts/bulk` | DELETE | Delete multiple contacts |
| `/api/broadcast/interest-rate` | POST | Start broadcast campaign |

---

## Troubleshooting

### CSV Upload Issues

**Problem**: CSV upload fails or shows errors
**Solutions**:
1. Verify first row has exact headers: `name,phone,email,tier`
2. Check phone numbers are in correct format (65XXXXXXXX)
3. Ensure no special characters in CSV
4. Save CSV as UTF-8 encoding
5. Download and use the official template

**Problem**: Some contacts are missing after import
**Solutions**:
1. Check phone numbers are not blank
2. Verify CSV has no empty rows
3. Ensure phone numbers don't have spaces or special characters

### Broadcast Issues

**Problem**: Broadcast button doesn't appear
**Solution**: Select at least one contact using checkboxes

**Problem**: Messages not sending
**Solutions**:
1. Verify WhatsApp bot is connected
2. Check phone numbers are in correct format
3. Ensure batch size is not too large (recommended: 10)
4. Verify delay between messages is at least 3 seconds

### Search & Filter Issues

**Problem**: Search returns no results
**Solutions**:
1. Check spelling of search terms
2. Try searching just part of the name/phone
3. Clear tier filter
4. Refresh the page to reload contacts

---

## Best Practices

### For CSV Uploads
1. Always use the official template
2. Verify phone numbers before uploading
3. Keep contact lists organized by purpose
4. Use descriptive list names
5. Test with small CSV first (3-5 contacts)

### For Broadcasting
1. Personalize messages with `{name}` placeholder
2. Keep messages concise and clear
3. Use appropriate tier selection for targeted messaging
4. Don't exceed batch size of 10
5. Maintain 7-second delay to avoid spam detection
6. Include clear call-to-action
7. Test with 1-2 contacts first

### For Contact Management
1. Regularly update contact information
2. Remove inactive/invalid contacts
3. Use tier system consistently
4. Keep contact names properly formatted
5. Add email addresses when available for backup contact

---

## Quick Start Guide

### Upload Your First Contacts (CSV Method)

1. **Download Template**
   - Click "📥 Download CSV Template"
   - Open the downloaded file

2. **Add Your Contacts**
   ```csv
   name,phone,email,tier
   John Tan,6591234567,john@example.com,VIP
   Mary Lee,6598765432,mary@example.com,Premium
   ```

3. **Upload CSV**
   - Click "+ Create Contact List"
   - Go to "CSV Upload" tab
   - Enter list name: "My First Contact List"
   - Drag & drop your CSV file
   - Review preview
   - Click "Import Contacts"

4. **Verify Upload**
   - Check contacts appear in the table
   - Verify count matches your CSV
   - Test search functionality

### Send Your First Broadcast

1. **Select Recipients**
   - Check boxes next to 2-3 test contacts
   - Verify count: "X selected"

2. **Configure Broadcast**
   - Click "📢 Broadcast Interest Rate Message"
   - Enter message:
     ```
     Dear {name},

     Test broadcast message.
     This is a test of our new system.

     Thank you!
     ```
   - Leave batch size: 10
   - Leave delay: 7 seconds

3. **Send**
   - Click "Start Broadcast"
   - Monitor progress
   - Verify messages received

---

## Support

For technical issues or questions:
1. Check this guide first
2. Verify CSV format matches template
3. Test with small datasets first
4. Contact system administrator if issues persist

---

## Version Information

- **Interface Version**: 2.0
- **Database**: Supabase PostgreSQL
- **CSV Format**: Standard RFC 4180
- **Supported Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
