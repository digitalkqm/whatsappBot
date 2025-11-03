# WhatsApp Bot with Frontend Dashboard

A self-contained WhatsApp automation bot with a web-based dashboard for QR code scanning and workflow management. **No n8n required** - all workflows run natively in Node.js.

## 🎯 Features

### ✅ What's New
- **Web Dashboard** - Scan QR codes directly in your browser
- **Real-time Updates** - WebSocket-powered live status
- **Native Workflows** - All workflows run natively in Node.js without n8n
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

### 3. Environment Configuration

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Start the Bot

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

### Valuation Request Workflow
**Trigger:** Valuation request messages from WhatsApp groups

**Process:**
1. Parses valuation request details
2. Routes to appropriate banker via keyword matching
3. Saves request to Supabase database
4. Forwards request to banker's WhatsApp group
5. Sends acknowledgment to requester

**Features:**
- Automatic banker routing based on keywords
- Database persistence with forward tracking
- Real-time notifications

### Valuation Reply Workflow
**Trigger:** Banker replies to forwarded valuation requests

**Process:**
1. Identifies original valuation request via quoted message
2. Updates database with banker's response
3. Forwards reply to requester group
4. Notifies agent contact (if configured)

**Features:**
- Clarification question detection
- Multi-party notification system
- Message thread tracking

### Rate Update Workflows
**Triggers:** Bank rate updates and rate package updates

**Process:**
1. Detects rate update messages
2. Forwards to n8n webhook for processing
3. Sends group notifications with progress updates

**Features:**
- Webhook integration for external processing
- Real-time status updates
- Error handling and notifications

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
- `workflows/valuationRequestSupabase.js` - Valuation request processing
- `workflows/valuationReplySupabase.js` - Valuation reply handling
- `workflows/ratePackageUpdate.js` - Rate package updates
- `workflows/bankRatesUpdate.js` - Bank rates updates
- `workflows/engine.js` - Core workflow engine

## 🏗️ Architecture

```
├── index.js                          # Main bot server
├── workflows/
│   ├── engine.js                    # Workflow execution engine
│   ├── valuationRequestSupabase.js  # Valuation request workflow
│   ├── valuationReplySupabase.js    # Valuation reply workflow
│   ├── ratePackageUpdate.js         # Rate package workflow
│   └── bankRatesUpdate.js           # Bank rates workflow
├── api/
│   ├── bankerAPI.js                 # Banker management
│   ├── broadcastContactAPI.js       # Broadcast contacts
│   ├── contactAPI.js                # Contact management
│   ├── imageUploadAPI.js            # Image uploads (ImageKit)
│   ├── templateAPI.js               # Message templates
│   ├── valuationAPI.js              # Valuation queries
│   └── workflowAPI.js               # Workflow management
├── utils/
│   └── messageSendQueue.js          # Priority message queue
└── public/
    ├── index.html                   # Dashboard UI
    ├── contacts.html                # Broadcast manager
    └── *.js, *.css                  # Frontend assets
```

## 🔐 Security Notes

1. **Never commit `.env` file** - Contains sensitive credentials
2. **Rotate Supabase keys** regularly
3. **Use HTTPS** in production deployment
4. **Restrict dashboard access** with authentication (not included)
5. **Update dependencies** regularly for security patches

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
- Check Supabase connection and credentials
- Verify workflow triggers are configured correctly
- Review console logs for error messages

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
- **Supabase Help:** [Supabase Documentation](https://supabase.com/docs)

## 📝 License

MIT License - Use freely, no warranties provided.

## 🎉 Credits

Built with:
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- [Supabase](https://supabase.com/)
- [Express](https://expressjs.com/)
- [ws](https://github.com/websockets/ws)
- [ImageKit](https://imagekit.io/)
