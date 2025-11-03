# WhatsApp-Web.js Update Guide

## 🎯 Overview

This guide helps you safely update `whatsapp-web.js` without breaking your bot. The library changes frequently due to WhatsApp updates, so **manual testing is always required**.

---

## 🚨 Before You Update

### Check These First:

1. **Read the Changelog** 📖
   ```
   https://github.com/pedroslopez/whatsapp-web.js/releases
   ```
   Look for:
   - ⚠️ Breaking changes
   - 🔧 Configuration changes
   - 🐛 Known issues
   - 📱 WhatsApp compatibility notes

2. **Check GitHub Issues** 🐛
   ```
   https://github.com/pedroslopez/whatsapp-web.js/issues
   ```
   Search for: "latest version", "breaking", version number

3. **Community Status** 💬
   - Discord: https://discord.gg/H7DqQs4
   - Look for recent reports of issues

---

## 🛠️ Update Methods

### Method 1: Automated Script (Recommended)

**Windows PowerShell:**
```powershell
.\scripts\safe-update-whatsapp.ps1
```

**Linux/Mac:**
```bash
bash scripts/safe-update-whatsapp.sh
```

**What it does:**
- Creates backup branch
- Creates test branch
- Updates whatsapp-web.js
- Runs validation checks
- Guides you through testing
- Merges or rolls back based on results

### Method 2: Manual Update

```bash
# 1. Create backup
git checkout -b backup-whatsapp-$(date +%Y%m%d)

# 2. Check current version
npm list whatsapp-web.js

# 3. Check latest version
npm view whatsapp-web.js version

# 4. Update
npm install whatsapp-web.js@latest

# 5. Test (see testing checklist below)

# 6. If successful, commit
git add package.json package-lock.json
git commit -m "Update whatsapp-web.js to vX.X.X"
```

### Method 3: Specific Version

```bash
# If you need a specific version (e.g., to fix a bug)
npm install whatsapp-web.js@1.34.0

# Or use semver ranges
npm install whatsapp-web.js@^1.34.0  # Allow patch updates
npm install whatsapp-web.js@~1.34.0  # More restrictive
```

---

## ✅ Testing Checklist

**After updating, test ALL of these:**

### Core Functionality
- [ ] Bot starts without errors
- [ ] QR code generates and displays
- [ ] Can scan QR and authenticate
- [ ] WhatsApp connection establishes
- [ ] Session persists after restart

### Message Handling
- [ ] Can receive messages
- [ ] Can send text messages
- [ ] Can send images
- [ ] Can quote/reply to messages
- [ ] Message queue works

### Workflows
- [ ] Valuation request workflow triggers
- [ ] Valuation reply workflow works
- [ ] Rate package update workflow
- [ ] Bank rates update workflow
- [ ] Workflow engine functions

### Features
- [ ] Human behavior simulation works
- [ ] Rate limiting functions
- [ ] WebSocket connections work
- [ ] Dashboard updates in real-time
- [ ] Broadcast functionality (if used)

### Database
- [ ] Supabase connections work
- [ ] Data saves correctly
- [ ] Queries return expected results

---

## 🔄 Common Breaking Changes & Fixes

### Version 1.30+ → 1.34+

**Session Storage Format Changed:**
```javascript
// Old (before 1.30)
const { LocalAuth } = require('whatsapp-web.js');

// New (1.30+)
// Sessions may need to be re-authenticated
// Clear .wwebjs_auth/ and re-scan QR code if auth fails
```

**Fix:**
```bash
# If authentication fails after update
rm -rf .wwebjs_auth/
npm start
# Re-scan QR code
```

### Version 1.25+ Event Names

**Message Events Changed:**
```javascript
// Old
client.on('message', async (msg) => { ... })

// New (if breaks)
client.on('message_create', async (msg) => { ... })
```

**Current code already uses 'message' - but check if update changes this**

### Puppeteer Compatibility

**Chrome/Chromium Updates:**
```javascript
// If Puppeteer fails to launch Chrome
const client = new Client({
    authStrategy: new LocalAuth({ clientId: SESSION_ID }),
    puppeteer: {
        // Force specific Chrome path if needed
        executablePath: '/path/to/chrome',
        // Or use chromium
        executablePath: '/usr/bin/chromium-browser'
    }
});
```

### MessageMedia Changes

**Image Sending:**
```javascript
// Old
const media = MessageMedia.fromFilePath('./image.png');

// New (if changed)
const media = await MessageMedia.fromUrl('https://...');
await msg.sendMessage(chatId, media);
```

---

## 🐛 Troubleshooting Updates

### Issue: "Cannot find module 'whatsapp-web.js'"

**Solution:**
```bash
rm -rf node_modules/
rm package-lock.json
npm install
```

### Issue: QR Code Not Generating

**Solution:**
```bash
# Clear old session
rm -rf .wwebjs_auth/
rm -rf .wwebjs_cache/

# Reinstall
npm install

# Start fresh
npm start
```

### Issue: "Protocol error" or Chrome crashes

**Solution:**
```bash
# Update Puppeteer
npm install puppeteer@latest

# Or specify Chrome args
# In index.js:
puppeteer: {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
    ]
}
```

### Issue: Messages not sending

**Check:**
1. WhatsApp web is not open elsewhere
2. Phone has internet connection
3. Session is valid (`client.getState()`)
4. Rate limits not exceeded

**Fix:**
```bash
# Restart bot
# Re-authenticate if needed
```

### Issue: Update breaks workflows

**Rollback:**
```bash
# Find working version
git log package.json

# Checkout old package.json
git checkout <commit-hash> -- package.json package-lock.json

# Reinstall
npm install
```

---

## 📊 Version Compatibility Matrix

| Your Version | Update To | Risk Level | Notes |
|--------------|-----------|------------|-------|
| 1.23.x | 1.34.x | High | Major changes, test thoroughly |
| 1.30.x | 1.34.x | Medium | Session format may differ |
| 1.32.x | 1.34.x | Low | Minor updates, safer |
| 1.34.x | Latest patch | Very Low | Patch updates usually safe |

---

## 🔐 Migration Strategies

### Strategy 1: Incremental Updates (Safest)

Update one minor version at a time:
```bash
# Current: 1.30.0
npm install whatsapp-web.js@1.31.0  # Test
npm install whatsapp-web.js@1.32.0  # Test
npm install whatsapp-web.js@1.33.0  # Test
npm install whatsapp-web.js@1.34.0  # Test
```

### Strategy 2: Blue-Green Deployment

Run old and new versions simultaneously:
```bash
# Keep old version running
# Clone repo to new directory
git clone <repo> whatsapp-bot-test
cd whatsapp-bot-test

# Update in test environment
npm install whatsapp-web.js@latest

# Run on different port
PORT=3001 npm start

# Test thoroughly
# Switch traffic once validated
```

### Strategy 3: Staging Environment

```bash
# Always test in staging first
# Staging checklist:
# 1. Same Node.js version
# 2. Same environment variables
# 3. Test data (not production)
# 4. Full workflow testing
# 5. Monitor for 24-48 hours
# 6. Then deploy to production
```

---

## 🤖 Automation Setup

### Option 1: Dependabot (GitHub)

Already configured in `.github/dependabot.yml`

**What it does:**
- Creates PRs weekly for updates
- Groups whatsapp-web.js separately
- Requires manual review and testing
- Never auto-merges

**How to use:**
1. Push to GitHub
2. Enable Dependabot in repo settings
3. Review PRs when created
4. Test locally before merging

### Option 2: Manual with npm-check-updates

```bash
# Install globally
npm install -g npm-check-updates

# Check for updates
ncu

# Check whatsapp-web.js only
ncu whatsapp-web.js

# Update interactively
ncu -i

# Update package.json (doesn't install)
ncu -u whatsapp-web.js

# Then install
npm install
```

---

## 📅 Update Schedule Recommendation

| Frequency | What to Check | Action |
|-----------|---------------|--------|
| **Weekly** | GitHub releases | Read changelog, note breaking changes |
| **Bi-weekly** | npm outdated | Check if update available |
| **Monthly** | Plan update | Schedule testing window |
| **As needed** | Critical bugs | Urgent update if security/stability issue |

**Best time to update:**
- 🟢 Good: After major WhatsApp changes (within 2 weeks)
- 🟢 Good: When fix addresses your issue
- 🟡 Caution: During busy periods
- 🔴 Avoid: Friday deployments
- 🔴 Avoid: Before holidays

---

## 🆘 Emergency Rollback

**If update breaks production:**

```bash
# Quick rollback
git checkout main  # Or your production branch
git revert HEAD    # Revert last commit
npm install        # Reinstall old version
npm start          # Restart

# Alternative: Reset to previous version
git reset --hard HEAD~1
npm install
npm start

# Nuclear option: Use backup
git checkout <working-commit-hash>
npm install
npm start
```

---

## 📞 Getting Help

1. **Check Official Docs**: https://docs.wwebjs.dev/
2. **GitHub Issues**: Report bugs with version info
3. **Discord Community**: Quick help from users
4. **Stack Overflow**: Tag `whatsapp-web.js`

**When reporting issues, include:**
- whatsapp-web.js version
- Node.js version
- Operating system
- Error messages
- Steps to reproduce

---

## ✅ Post-Update Checklist

After successful update:

- [ ] Update CHANGELOG.md with changes
- [ ] Document any code changes needed
- [ ] Update SECURITY.md if vulnerabilities fixed
- [ ] Monitor for 24 hours in production
- [ ] Note any performance changes
- [ ] Update this guide if new issues found

---

**Last Updated:** 2025-11-03
**For Version:** whatsapp-web.js 1.34.x
**Next Review:** When 1.35.x releases
