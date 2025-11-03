# Automation Scripts

This directory contains scripts for safely managing whatsapp-web.js updates and other maintenance tasks.

## 📜 Available Scripts

### `safe-update-whatsapp.ps1` (Windows PowerShell)
Safe update script for whatsapp-web.js with automated testing and rollback.

**Usage:**
```powershell
.\scripts\safe-update-whatsapp.ps1
```

**Features:**
- Creates backup and test branches automatically
- Updates whatsapp-web.js to latest version
- Runs validation checks
- Guides through manual testing
- Merges on success or rolls back on failure

### `safe-update-whatsapp.sh` (Linux/Mac Bash)
Same functionality as PowerShell version, for Unix-based systems.

**Usage:**
```bash
bash scripts/safe-update-whatsapp.sh
# or
chmod +x scripts/safe-update-whatsapp.sh
./scripts/safe-update-whatsapp.sh
```

## 🚀 Quick Commands

All scripts can also be run via npm:

```bash
# Check for available updates
npm run check-updates

# Check whatsapp-web.js version specifically
npm run check-whatsapp

# Security audit
npm run audit

# Run safe update (shows instructions)
npm run update-safe
```

## 📖 Documentation

For detailed update procedures and troubleshooting, see:
- `/docs/WHATSAPP_UPDATE_GUIDE.md` - Comprehensive update guide

## ⚠️ Important Notes

1. **Always test updates** - whatsapp-web.js has frequent breaking changes
2. **Read changelogs** - Check GitHub releases before updating
3. **Backup first** - Scripts create backups, but manual backups recommended
4. **Test workflows** - All bot workflows must be tested after updates
5. **Check community** - Search GitHub issues for known problems

## 🔧 Customization

To modify update behavior, edit the respective script file:
- Windows: `safe-update-whatsapp.ps1`
- Linux/Mac: `safe-update-whatsapp.sh`

Variables you might want to change:
- Branch naming conventions
- Test requirements
- Validation checks
- Commit message format
