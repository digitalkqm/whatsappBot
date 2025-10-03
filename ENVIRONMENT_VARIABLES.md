# 📝 Environment Variables Reference

Quick reference guide for all environment variables needed on Render.

## 🔴 Required Variables

Copy and paste these into Render's Environment Variables section.

### Server Configuration

```
PORT=3000
```
- Default server port
- Render uses this to route traffic
- Don't change unless necessary

```
NODE_VERSION=18.0.0
```
- Ensures compatible Node.js version
- Required for ES6+ features

```
WHATSAPP_SESSION_ID=production_session
```
- Unique identifier for this bot instance
- Change if running multiple bots
- Must match across restarts to maintain session

```
APP_URL=https://your-app-name.onrender.com
```
- **UPDATE THIS** after first deployment
- Your actual Render URL
- Used for self-referencing in workflows
- Format: `https://your-service-name.onrender.com`

### Supabase Configuration

```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
```
- Get from Supabase Dashboard → Settings → API → Project URL
- Format: `https://[project-id].supabase.co`

```
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- Get from Supabase Dashboard → Settings → API → anon public
- Long JWT token starting with `eyJ`
- Safe to expose in frontend (but keep secure anyway)

### Google Sheets Integration

```
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```
- **MUST be single-line JSON** (no line breaks!)
- Download from Google Cloud Console → Service Account → Keys
- Open the JSON file and remove all newlines
- Contains private key - keep secure!

```
INTEREST_RATE_SPREADSHEET_ID=1Q1rxsHPQPmOPcxDEKCUN3mG_lZZwfhAOm5sSMArggT8
```
- Get from Google Sheets URL
- Format: `https://docs.google.com/spreadsheets/d/[THIS_PART_IS_THE_ID]/edit`
- Sheet must be shared with service account email

```
VALUATION_SPREADSHEET_ID=1A2b3C4d5E6f7G8h9I0jK1lM2nO3pQ4rS5tU6vW7xY8z
```
- Same process as Interest Rate spreadsheet
- Different sheet for valuation data

## 🟡 Optional Variables

Only set these if you want to keep using n8n webhooks alongside native workflows.

### n8n Webhook URLs

```
N8N_WEBHOOK_URL=
```
- Leave empty to disable
- Or set to: `https://your-n8n.app/webhook/xxxxx`

```
INTEREST_RATE_WEBHOOK_URL=
```
- Leave empty to use native workflow
- Legacy n8n webhook for interest rates

```
VALUATION_WEBHOOK_URL=
```
- Leave empty to use native workflow
- Legacy n8n webhook for valuations

```
UPDATE_RATE_WEBHOOK_URL=
```
- Leave empty to disable
- Legacy n8n webhook for rate updates

## 📋 How to Add on Render

### Method 1: During Service Creation

1. Click "Advanced" when creating service
2. Scroll to "Environment Variables"
3. Click "Add Environment Variable"
4. Enter **Key** and **Value**
5. Repeat for all variables
6. Click "Create Web Service"

### Method 2: After Service Created

1. Go to your service dashboard
2. Click "Environment" tab
3. Click "Add Environment Variable"
4. Enter **Key** and **Value**
5. Click "Save Changes"
6. Service will auto-redeploy

## ✅ Validation Checklist

Before deploying, verify:

- [ ] `SUPABASE_URL` starts with `https://` and ends with `.supabase.co`
- [ ] `SUPABASE_ANON_KEY` starts with `eyJ`
- [ ] `GOOGLE_SHEETS_CREDENTIALS` is valid JSON (test: paste into jsonlint.com)
- [ ] `GOOGLE_SHEETS_CREDENTIALS` has NO line breaks
- [ ] Spreadsheet IDs are ~44 characters long
- [ ] `APP_URL` matches your Render URL
- [ ] No trailing spaces in any values

## 🔒 Security Tips

1. **Never commit** these to GitHub
2. **Use Render's secret files** for extra security (optional)
3. **Rotate credentials** regularly (every 90 days)
4. **Limit spreadsheet access** to service account only
5. **Monitor Render logs** for suspicious activity

## 🔧 Testing Variables

### Local Testing

Create `.env` file (never commit):

```bash
PORT=3000
WHATSAPP_SESSION_ID=local_session
APP_URL=http://localhost:3000
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
INTEREST_RATE_SPREADSHEET_ID=1Q1rxs...
VALUATION_SPREADSHEET_ID=1A2b3C...
```

Run:
```bash
npm start
```

### Verify on Render

After deployment, check:

```bash
curl https://your-app.onrender.com/health
```

Should return connection status for all services.

## 🐛 Troubleshooting

### "SUPABASE_URL is not defined"

- Check exact spelling: `SUPABASE_URL` (all caps, underscore)
- No spaces before/after value
- Redeploy after adding

### "Invalid Google credentials"

- Verify JSON is single line
- Check all quotes are standard (not smart quotes)
- Ensure private key includes `-----BEGIN` and `-----END`
- Test JSON validity: paste into jsonlint.com

### "Permission denied" on Google Sheets

- Share sheet with service account email
- Email format: `name@project-id.iam.gserviceaccount.com`
- Grant "Editor" access
- Check spreadsheet ID matches environment variable

### Variables not updating

- After changing variables, Render auto-redeploys
- Wait for "Live" status before testing
- Clear browser cache if using dashboard
- Check "Events" tab for deployment status

## 📞 Quick Copy Template

For easy copy-paste into Render:

```
PORT=3000
NODE_VERSION=18.0.0
WHATSAPP_SESSION_ID=production_session
APP_URL=https://CHANGE-THIS.onrender.com
SUPABASE_URL=https://CHANGE-THIS.supabase.co
SUPABASE_ANON_KEY=CHANGE-THIS
GOOGLE_SHEETS_CREDENTIALS=CHANGE-THIS-SINGLE-LINE-JSON
INTEREST_RATE_SPREADSHEET_ID=CHANGE-THIS
VALUATION_SPREADSHEET_ID=CHANGE-THIS
```

Replace all `CHANGE-THIS` values with your actual credentials!

---

**Need help?** Check the [RENDER_SETUP.md](./RENDER_SETUP.md) guide for detailed setup instructions.
