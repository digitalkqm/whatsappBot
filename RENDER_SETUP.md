# 🚀 Render.com Deployment Guide

Complete guide to deploy your WhatsApp Bot on Render with environment variables and database setup.

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Render.com account (free tier works)
- [ ] Supabase account
- [ ] Google Service Account credentials
- [ ] Google Sheets with data

## 🔧 Step 1: Prepare Your Code

### 1.1 Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "WhatsApp bot with frontend dashboard"

# Create new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/whatsappBot.git
git branch -M main
git push -u origin main
```

### 1.2 Add .gitignore

Make sure you have `.gitignore`:

```
node_modules/
.env
.wwebjs_auth/
*.log
.DS_Store
```

## 🏗️ Step 2: Setup Supabase Database

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - Name: `whatsapp-bot`
   - Database Password: (save this!)
   - Region: Choose closest to you
4. Click **"Create new project"**
5. Wait for provisioning (~2 minutes)

### 2.2 Get Supabase Credentials

1. Go to **Project Settings** (gear icon)
2. Click **API**
3. Copy these values:
   - **Project URL** → This is your `SUPABASE_URL`
   - **anon public** key → This is your `SUPABASE_ANON_KEY`

### 2.3 Create Database Tables

1. Click **SQL Editor** in sidebar
2. Click **"New query"**
3. Paste this SQL:

```sql
-- WhatsApp sessions table
CREATE TABLE whatsapp_sessions (
  session_key TEXT PRIMARY KEY,
  session_data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_sessions_updated ON whatsapp_sessions(updated_at);

-- Workflow state table
CREATE TABLE workflow_state (
  workflow_name TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (workflow_name, key)
);

-- Create index for workflow queries
CREATE INDEX idx_workflow_state ON workflow_state(workflow_name, key);
```

4. Click **"Run"**
5. Verify tables created (check **Table Editor** sidebar)

## 📊 Step 3: Setup Google Sheets Integration

### 3.1 Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Name: `whatsapp-bot`
4. Click **"Create"**

### 3.2 Enable Google Sheets API

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Sheets API"**
3. Click on it → Click **"Enable"**

### 3.3 Create Service Account

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"Service Account"**
3. Fill in:
   - Name: `whatsapp-bot-service`
   - ID: (auto-generated)
4. Click **"Create and Continue"**
5. Role: Select **"Editor"** (or "Basic" → "Editor")
6. Click **"Continue"** → **"Done"**

### 3.4 Download Service Account Key

1. Click on the service account you just created
2. Go to **"Keys"** tab
3. Click **"Add Key"** → **"Create new key"**
4. Choose **JSON** format
5. Click **"Create"**
6. **Save the downloaded JSON file securely!**

### 3.5 Prepare Google Sheets

#### Interest Rate Sheet

1. Create new Google Sheet
2. Name it: `Interest Rates Update`
3. Create tab called **"Clients"**
4. Setup columns:

| A (Name) | B (Contact) | C (Updates) | D (Content) | E (lastIndex) | F (Message) | G | H (imgURL) |
|----------|-------------|-------------|-------------|---------------|-------------|---|------------|
| Header   | Header      | Header      | Header      | Header        | Header      |   | Header     |
| John Doe | 6591234567  | lastIndex   | 0           | 0             |             |   |            |

- Cell **E1**: "lastIndex"
- Cell **E2**: `lastIndex` (text)
- Cell **F1**: "Message"
- Cell **F2**: (leave empty - will be populated by workflow)
- Cell **H1**: "imgURL"
- Cell **H2**: (optional image URL)

5. Add your contacts starting from **Row 2**:
   - Column A: Contact names
   - Column B: Phone numbers (without country code, e.g., 6591234567)

6. Copy the **Spreadsheet ID** from URL:
   ```
   https://docs.google.com/spreadsheets/d/1Q1rxsHPQPmOPcxDEKCUN3mG_lZZwfhAOm5sSMArggT8/edit
                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                            This is your SPREADSHEET ID
   ```

#### Valuation Sheet

1. Create another Google Sheet
2. Name it: `Property Valuations`
3. Create tab called **"Valuations"**
4. Setup columns:

| A (Timestamp) | B (Group ID) | C (Sender ID) | D (Message ID) | E (Address) | F (Property Type) | G (Bedrooms) | H (Floor Area) | I (Asking Price) | J (Raw Message) | K (Reply Message) |
|---------------|--------------|---------------|----------------|-------------|-------------------|--------------|----------------|------------------|-----------------|-------------------|

5. Copy this spreadsheet's ID as well

### 3.6 Share Sheets with Service Account

1. Open the JSON key file you downloaded
2. Find the `client_email` field (looks like: `whatsapp-bot-service@project-id.iam.gserviceaccount.com`)
3. **Copy this email**
4. Go to each Google Sheet
5. Click **"Share"**
6. Paste the service account email
7. Give **"Editor"** access
8. Uncheck **"Notify people"**
9. Click **"Share"**

### 3.7 Prepare Credentials String

1. Open your downloaded JSON file
2. **Remove all newlines** - make it a single line
3. It should look like:
   ```json
   {"type":"service_account","project_id":"your-project","private_key_id":"abc123",...}
   ```
4. **Save this - you'll paste it into Render**

## 🚢 Step 4: Deploy to Render

### 4.1 Create Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your **GitHub** account if not already
4. Select your **whatsappBot** repository
5. Click **"Connect"**

### 4.2 Configure Service

Fill in the form:

- **Name**: `whatsapp-bot` (or your choice)
- **Region**: Choose closest to you
- **Branch**: `main`
- **Root Directory**: (leave empty)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: `Free` (or paid for better performance)

### 4.3 Add Environment Variables

Click **"Advanced"** → Scroll to **"Environment Variables"**

Add each variable by clicking **"Add Environment Variable"**:

#### Required Variables

| Key | Value | Notes |
|-----|-------|-------|
| `PORT` | `3000` | Default port |
| `NODE_VERSION` | `18.0.0` | Node.js version |
| `WHATSAPP_SESSION_ID` | `production_session` | Unique identifier |
| `SUPABASE_URL` | `https://xxx.supabase.co` | From Step 2.2 |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` | From Step 2.2 |
| `GOOGLE_SHEETS_CREDENTIALS` | `{"type":"service_account",...}` | From Step 3.7 (single line JSON) |
| `INTEREST_RATE_SPREADSHEET_ID` | `1Q1rxsHP...` | From Step 3.5 |
| `VALUATION_SPREADSHEET_ID` | `1A2bCd3E...` | From Step 3.5 |
| `APP_URL` | `https://your-app.onrender.com` | Will update after deploy |

#### Optional Variables (if keeping n8n)

| Key | Value |
|-----|-------|
| `N8N_WEBHOOK_URL` | (your n8n webhook) |
| `INTEREST_RATE_WEBHOOK_URL` | (your n8n webhook) |
| `VALUATION_WEBHOOK_URL` | (your n8n webhook) |
| `UPDATE_RATE_WEBHOOK_URL` | (your n8n webhook) |

**Leave these empty to use only native workflows!**

### 4.4 Deploy

1. Click **"Create Web Service"**
2. Render will start building and deploying
3. Wait for **"Build successful"** (5-10 minutes first time)
4. Wait for **"Live"** status

### 4.5 Update APP_URL

1. Copy your Render URL: `https://whatsapp-bot-xxxx.onrender.com`
2. Go to **"Environment"** tab
3. Find `APP_URL` variable
4. Click **"Edit"**
5. Paste your Render URL
6. Click **"Save Changes"**
7. Service will auto-redeploy

## 📱 Step 5: Authenticate WhatsApp

### 5.1 Access Dashboard

1. Go to your Render URL: `https://your-app.onrender.com`
2. You should see the dashboard
3. Wait for QR code to appear (may take 30-60 seconds on free tier)

### 5.2 Scan QR Code

1. Open WhatsApp on your phone
2. Go to **Settings** (⋮ menu)
3. Tap **"Linked Devices"**
4. Tap **"Link a Device"**
5. **Scan the QR code** on your dashboard
6. Wait for authentication (~10 seconds)

### 5.3 Verify Connection

1. Dashboard should show **"Connected"** status
2. Check Render logs: **"✅ WhatsApp client is ready"**
3. Session saved to Supabase automatically

## ✅ Step 6: Test Workflows

### Test Interest Rate Workflow

1. Create a WhatsApp group for testing
2. Add the bot number to the group
3. Send a message: `KeyQuest Mortgage Team - New rates available!`
4. Bot should process and start sending to contacts in spreadsheet

### Test Valuation Workflow

1. In a WhatsApp group with the bot
2. Send a message: `Valuation Request: 123 Main St, 3 bedroom HDB, 1200 sqft`
3. Check Valuation spreadsheet - should have new row

## 🔍 Monitoring & Troubleshooting

### View Logs

1. Go to Render dashboard
2. Click on your service
3. Click **"Logs"** tab
4. See real-time logs

### Health Check

Visit: `https://your-app.onrender.com/health`

Should return:
```json
{
  "status": "healthy",
  "whatsapp": { "state": "CONNECTED" },
  "supabase": "CONNECTED"
}
```

### Common Issues

#### QR Code Not Appearing
- Check Render logs for errors
- Free tier: First request may timeout (refresh page)
- Verify all environment variables set correctly

#### "SUPABASE_URL not configured"
- Double-check environment variable name (exact spelling)
- Verify value is correct URL format
- Redeploy after adding

#### Google Sheets Permission Denied
- Verify service account email shared with sheets
- Check "Editor" access granted
- Verify GOOGLE_SHEETS_CREDENTIALS is valid JSON (single line)

#### Session Not Persisting
- Check Supabase tables exist
- Verify SUPABASE_ANON_KEY is correct
- Check Render logs for Supabase errors

#### Workflows Not Running
- Check spreadsheet IDs match environment variables
- Verify Google Sheets API enabled
- Check service account has Editor access

## 🔒 Security Best Practices

1. **Never commit credentials** to GitHub
2. Use Render's **secret files** for sensitive data
3. **Rotate service account keys** every 90 days
4. **Enable 2FA** on Render, Google, and Supabase
5. **Restrict Supabase RLS** policies (optional)

## 💰 Cost Optimization

### Free Tier Usage
- Render Free: 750 hours/month (enough for 1 service)
- Supabase Free: 500MB database, 2GB bandwidth
- Google Sheets API: Free up to 100 requests/100 seconds

### Upgrade When Needed
- **Render Starter ($7/mo)**: Faster, always-on, no spin-down
- **Supabase Pro ($25/mo)**: More storage, better performance
- Performance boost recommended for production use

## 🎯 Production Checklist

- [ ] All environment variables set on Render
- [ ] Supabase tables created
- [ ] Google Sheets shared with service account
- [ ] APP_URL updated with Render URL
- [ ] QR code scanned and authenticated
- [ ] Test message sent successfully
- [ ] Workflows tested (interest rate + valuation)
- [ ] Logs monitored for errors
- [ ] Dashboard accessible and showing status

## 🆘 Support Resources

- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Google Sheets API**: [developers.google.com/sheets](https://developers.google.com/sheets/api)
- **WhatsApp Web.js**: [wwebjs.dev](https://wwebjs.dev/)

## 📞 Next Steps

After successful deployment:

1. **Monitor first 24 hours** - Check logs regularly
2. **Test all workflows** - Send test messages
3. **Set up monitoring** - Use Render's metrics
4. **Configure auto-updates** - Enable auto-deploy on push
5. **Document for team** - Share dashboard URL and usage

---

**🎉 Congratulations!** Your WhatsApp bot is now live on Render with a web dashboard!

Access your dashboard at: `https://your-app.onrender.com`
