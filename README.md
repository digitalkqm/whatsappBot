# WhatsApp Bot with Frontend Dashboard

A self-contained WhatsApp automation bot with a web-based dashboard for QR code scanning and workflow management. **No n8n required** - all workflows run natively in Node.js.

## 🎯 Features

### ✅ What's New
- **Web Dashboard** - Scan QR codes directly in your browser
- **Real-time Updates** - WebSocket-powered live status
- **Native Workflows** - Google Sheets integration without n8n
- **Self-Contained** - Single service deployment
- **Session Management** - Persistent authentication via Supabase

### 🔧 Core Functionality
- Interest Rate updates to contact lists
- Property Valuation request processing
- Human-like behavior simulation
- Rate limiting and active hours
- Automatic session backup

## 📋 Prerequisites

1. **Node.js** >= 18.0.0
2. **Supabase Account** (free tier works)
3. **Google Cloud Project** with Sheets API enabled
4. **Google Service Account** credentials

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a table for session storage:

```sql
-- WhatsApp sessions table
CREATE TABLE whatsapp_sessions (
  session_key TEXT PRIMARY KEY,
  session_data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow state table (optional)
CREATE TABLE workflow_state (
  workflow_name TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (workflow_name, key)
);
```

### 3. Setup Google Sheets

#### Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Sheets API**
4. Create **Service Account** credentials
5. Download JSON key file

#### Share Spreadsheets
1. Create your Google Sheets for:
   - Interest Rate contacts
   - Valuation requests
2. Share each sheet with service account email (found in JSON)
3. Grant **Editor** access

#### Spreadsheet Structure

**Interest Rate Sheet (Clients tab):**
| Name | Contact | Updates | Content | imgURL |
|------|---------|---------|---------|--------|
| John | 6512345678 | lastIndex | (auto) | (optional) |

**Valuation Sheet:**
| Timestamp | Group ID | Sender ID | Message ID | Address | Property Type | Bedrooms | Floor Area | Asking Price | Raw Message | Reply Message |
|-----------|----------|-----------|------------|---------|---------------|----------|------------|--------------|-------------|---------------|

### 4. Environment Configuration

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account",...}'
INTEREST_RATE_SPREADSHEET_ID=your_spreadsheet_id
VALUATION_SPREADSHEET_ID=your_spreadsheet_id
```

### 5. Start the Bot

```bash
npm start
```

Access dashboard at: **http://localhost:3000**

## 📱 Using the Dashboard

### First Time Setup
1. Open http://localhost:3000 in your browser
2. Wait for QR code to appear
3. Open WhatsApp on your phone
4. Go to **Settings** → **Linked Devices** → **Link a Device**
5. Scan the QR code
6. Bot is now authenticated!

### Dashboard Features

#### Status Panel
- Real-time WhatsApp connection status
- Message processing stats (hourly/daily)
- Active hours indicator
- System memory usage

#### Controls
- **Toggle Break Mode** - Pause message processing
- **Save Session** - Manually backup authentication
- **Clear Session** - Logout and reset
- **Refresh QR** - Generate new QR code

#### Workflows
- View active workflow executions
- Monitor completion status
- Track errors in real-time

## 🔄 Workflows

### Interest Rate Workflow
**Trigger:** WhatsApp message containing "keyquest mortgage team"

**Process:**
1. Reads message content from WhatsApp
2. Updates Google Sheet with message text
3. Processes contacts in batches of 10
4. Sends personalized messages with delays
5. Updates progress after each batch
6. Waits 10 minutes between batches

**Spreadsheet Requirements:**
- Column E2: Last processed index
- Column F2: Message content
- Column H2: Image URL (optional)
- Columns A-B: Name and Contact list

### Valuation Workflow
**Trigger:** WhatsApp message containing "valuation request" or reply to valuation request

**Process:**
1. Extracts property details from message
2. Saves to Google Sheet
3. Sends acknowledgment message
4. Logs for team review

**Data Extracted:**
- Address/Location
- Property Type (HDB/Condo/Landed)
- Bedrooms
- Floor Area
- Asking Price (if mentioned)

## 🔧 Configuration

### Human-like Behavior

Configured in `index.js`:

```javascript
const HUMAN_CONFIG = {
  MAX_MESSAGES_PER_HOUR: 80,
  MAX_MESSAGES_PER_DAY: 680,
  ACTIVE_HOURS_START: 7,    // 7 AM
  ACTIVE_HOURS_END: 23,      // 11 PM
  // ... more settings
};
```

### Workflow Customization

Edit workflow files:
- `workflows/interestRate.js` - Contact broadcasting logic
- `workflows/valuation.js` - Valuation processing
- `workflows/engine.js` - Core workflow engine

## 🏗️ Architecture

```
├── index.js                 # Main bot server
├── workflows/
│   ├── engine.js           # Workflow execution engine
│   ├── interestRate.js     # Interest rate workflow
│   └── valuation.js        # Valuation workflow
├── public/
│   ├── index.html          # Dashboard UI
│   ├── styles.css          # Dashboard styling
│   └── app.js              # Frontend JavaScript
└── json/                   # Legacy n8n workflow exports
```

## 🔐 Security Notes

1. **Never commit `.env` file** - Contains sensitive credentials
2. **Rotate service account keys** regularly
3. **Limit Google Sheets access** to service account only
4. **Use HTTPS** in production deployment
5. **Restrict dashboard access** with authentication (not included)

## 🚀 Deployment

### Render.com
1. Push code to GitHub
2. Create new Web Service on Render
3. Set environment variables
4. Deploy!

**Important:** Set `APP_URL` to your Render URL:
```
APP_URL=https://your-app.onrender.com
```

### Railway/Heroku
Similar process - ensure all environment variables are set.

## 🐛 Troubleshooting

### QR Code Not Showing
- Check console logs for errors
- Restart the bot
- Clear Supabase session: `DELETE FROM whatsapp_sessions WHERE session_key = 'default_session'`

### Workflows Not Running
- Verify `GOOGLE_SHEETS_CREDENTIALS` is valid JSON
- Check spreadsheet IDs are correct
- Ensure service account has **Editor** access to sheets

### Session Lost After Restart
- Check Supabase connection
- Verify session backup in database
- Authentication may need to be redone if session is corrupted

## 📊 Monitoring

### Health Endpoint
```bash
curl http://localhost:3000/health
```

Returns:
```json
{
  "status": "healthy",
  "whatsapp": { "state": "CONNECTED" },
  "supabase": "CONNECTED",
  "humanBehavior": { ... },
  "system": { "memory": { ... } }
}
```

### Workflows Endpoint
```bash
curl http://localhost:3000/workflows
```

## 🆘 Support

- **Documentation Issues:** Open GitHub issue
- **WhatsApp.js Questions:** See [whatsapp-web.js docs](https://wwebjs.dev/)
- **Google Sheets API:** [Google API Docs](https://developers.google.com/sheets/api)

## 📝 License

MIT License - Use freely, no warranties provided.

## 🎉 Credits

Built with:
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- [googleapis](https://github.com/googleapis/google-api-nodejs-client)
- [express](https://expressjs.com/)
- [ws](https://github.com/websockets/ws)
