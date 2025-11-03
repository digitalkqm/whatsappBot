# Quick Deployment Guide

**Status:** ✅ Ready to deploy

---

## 🚀 Deploy to Render.com (10 minutes)

### Prerequisites
- [x] GitHub account
- [x] Render.com account (free)
- [x] Supabase account (free)
- [x] Code pushed to GitHub

---

## Step 1: Prepare Environment Variables

Copy these values from your accounts:

### From Supabase Dashboard
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxx...
```

### From ImageKit Dashboard (if using)
```
IMAGEKIT_PUBLIC_KEY=public_xxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/xxxxx
```

### Generate Strong Session ID
```bash
# Use this or generate random string
WHATSAPP_SESSION_ID=prod_bot_$(date +%s)
```

---

## Step 2: Push to GitHub

```bash
# Ensure all changes are committed
git status

# Push to main
git push origin main
```

---

## Step 3: Create Render Service

1. Go to https://render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Render auto-detects `render.yaml`
5. Click **"Create Web Service"**

---

## Step 4: Set Environment Variables

In Render dashboard, add these environment variables:

### Required
```
NODE_ENV=production
WHATSAPP_SESSION_ID=prod_bot_1234567890
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxx...
APP_URL=https://your-app-name.onrender.com
```

### Optional (ImageKit)
```
IMAGEKIT_PUBLIC_KEY=public_xxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/xxxxx
```

**Note:** Get `APP_URL` after service is created, then update it.

---

## Step 5: Deploy

1. Click **"Deploy"**
2. Wait for build (2-3 minutes)
3. Monitor logs for errors
4. Wait for health check to pass

**Build logs will show:**
```
==> Installing dependencies...
==> Building...
==> Starting server...
✅ Server is running on port 3000
✅ Health check passed
```

---

## Step 6: Initial Setup

### Access Dashboard
```
https://your-app-name.onrender.com
```

### Authenticate WhatsApp
1. Open dashboard in browser
2. Wait for QR code (may take 30-60 seconds on first load)
3. Open WhatsApp on phone
4. Go to **Settings** → **Linked Devices**
5. Scan QR code
6. Wait for "Connected" status

---

## Step 7: Verify Everything Works

### Test Checklist
- [ ] Dashboard loads
- [ ] QR code appears
- [ ] WhatsApp authenticates
- [ ] Connection status shows "Connected"
- [ ] Health check passes: `https://your-app.onrender.com/health`
- [ ] Can send test message
- [ ] Workflow triggers (test one)

---

## Step 8: Monitor First 24 Hours

### Check These
- [ ] No errors in Render logs
- [ ] Memory usage stable (<400MB)
- [ ] WhatsApp stays connected
- [ ] Messages process correctly
- [ ] Workflows execute successfully

---

## 🔧 Post-Deployment Configuration

### Update APP_URL (Important!)

After first deployment, update environment variable:

```
APP_URL=https://your-actual-app-name.onrender.com
```

**Then:** Redeploy to apply changes

### Set Up Monitoring

1. **Render Built-in**
   - View logs in dashboard
   - Check metrics
   - Enable email alerts

2. **External (Optional)**
   ```
   UptimeRobot.com (free):
   - Monitor: https://your-app.onrender.com/health
   - Alert interval: 5 minutes
   - Email on downtime
   ```

---

## ⚙️ Render Configuration

Your `render.yaml` automatically configures:

```yaml
✅ Node.js environment
✅ Puppeteer Chrome path
✅ Production build
✅ Health checks (30s interval)
✅ Auto-deploy on push
```

**No additional configuration needed!**

---

## 🐛 Troubleshooting

### Issue: Build Fails

**Check:**
- Node version (requires >=20.0.0)
- All dependencies in package.json
- No syntax errors

**Fix:**
```bash
# Test locally first
npm install
npm start
```

### Issue: Health Check Fails

**Symptoms:** Service marked unhealthy
**Wait:** 90 seconds for WhatsApp client initialization
**Check:** Logs for error messages

**Fix:**
```bash
# Check health endpoint manually
curl https://your-app.onrender.com/health
```

### Issue: QR Code Not Appearing

**Causes:**
- Puppeteer can't launch Chrome
- Environment variables missing

**Fix:**
1. Check environment variables are set
2. Check logs for Puppeteer errors
3. Verify `PUPPETEER_EXECUTABLE_PATH` is set in render.yaml

### Issue: WhatsApp Disconnects

**Causes:**
- Session corrupted
- Phone disconnected
- WhatsApp web updated

**Fix:**
1. Clear session in Supabase
2. Re-scan QR code
3. Check phone is online

### Issue: Service Spins Down (Free Tier)

**Symptoms:** Slow first request after inactivity
**Cause:** Render free tier spins down after 15 min

**Options:**
1. Upgrade to paid plan ($7/mo)
2. Use external ping service
3. Accept cold starts

---

## 💰 Cost Estimation

### Free Tier (Starter)
```
Cost: $0/month
- Spins down after 15 min inactivity
- 512MB RAM
- Cold starts
- Good for testing
```

### Paid Plan (Recommended for Production)
```
Cost: $7/month (Standard)
- Always on (no spin down)
- 512MB RAM
- No cold starts
- Good for <1000 msgs/day
```

### Scaling Up
```
Cost: $25/month (Pro)
- 2GB RAM
- Higher performance
- Good for >1000 msgs/day
```

---

## 🔄 Continuous Deployment

**Already configured!** 🎉

Every time you push to `main`:
1. Render automatically builds
2. Runs tests
3. Deploys new version
4. Runs health checks

**To deploy changes:**
```bash
git add .
git commit -m "Your changes"
git push origin main
# Render auto-deploys!
```

---

## 📊 Expected Performance

### First Deployment
```
Build time: 2-3 minutes
Cold start: 30-60 seconds
WhatsApp auth: 10-20 seconds
Total: ~5 minutes to fully operational
```

### Subsequent Deploys
```
Build time: 1-2 minutes
Restart time: 20-30 seconds
WhatsApp reconnect: 5-10 seconds
Total: ~2 minutes
```

### Daily Operations
```
Message processing: <1 second
Workflow execution: 1-5 seconds
Dashboard load: <2 seconds
API response: <500ms
```

---

## ✅ Deployment Checklist

### Before Deploy
- [x] All code committed and pushed
- [x] Environment variables prepared
- [x] Supabase tables created
- [x] All tests passing locally

### During Deploy
- [ ] Render service created
- [ ] Environment variables set
- [ ] Build successful
- [ ] Health check passes

### After Deploy
- [ ] Dashboard accessible
- [ ] WhatsApp authenticated
- [ ] Test message sent/received
- [ ] One workflow tested
- [ ] Monitoring configured

### First 24 Hours
- [ ] Check logs twice
- [ ] Monitor memory usage
- [ ] Verify no disconnections
- [ ] Track message volume
- [ ] Note any errors

---

## 🎉 You're Done!

Your WhatsApp bot is now live in production! 🚀

### Next Steps

1. **Share dashboard URL** with your team
2. **Set up monitoring** (UptimeRobot)
3. **Schedule weekly check-ins** (review logs)
4. **Plan updates** (monthly dependency updates)
5. **Monitor usage** (consider upgrading if needed)

### Support

- **Render Issues:** https://render.com/docs
- **WhatsApp Issues:** See WHATSAPP_UPDATE_GUIDE.md
- **Security Issues:** See SECURITY.md
- **General Help:** See README.md

**Welcome to production!** 🎊
