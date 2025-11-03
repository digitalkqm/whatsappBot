# Safe WhatsApp-Web.js Update Script (PowerShell)
# This script creates a test branch, updates, and validates before merging

$ErrorActionPreference = "Stop"

Write-Host "🔄 WhatsApp-Web.js Safe Update Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

function Print-Status {
    param($Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Print-Warning {
    param($Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Print-Error {
    param($Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Step 1: Check current version
Write-Host "📊 Current Configuration:"
$CurrentVersion = (npm list whatsapp-web.js --depth=0 2>$null | Select-String "whatsapp-web.js@(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
Write-Host "   Current whatsapp-web.js: $CurrentVersion"

# Step 2: Check for available updates
Write-Host ""
Write-Host "🔍 Checking for updates..."
$LatestVersion = npm view whatsapp-web.js version
Write-Host "   Latest available: $LatestVersion"

if ($CurrentVersion -eq $LatestVersion) {
    Print-Status "Already on latest version!"
    exit 0
}

# Step 3: Ask for confirmation
Write-Host ""
$Confirmation = Read-Host "Update from $CurrentVersion to $LatestVersion? (y/N)"
if ($Confirmation -notmatch '^[Yy]$') {
    Print-Warning "Update cancelled"
    exit 0
}

# Step 4: Create backup branch
$BackupBranch = "backup-whatsapp-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Print-Status "Creating backup branch: $BackupBranch"
try {
    git checkout -b $BackupBranch 2>$null
} catch {
    Print-Warning "Git backup failed - continuing anyway"
}

# Step 5: Create test branch
$TestBranch = "test-whatsapp-update-$LatestVersion"
Print-Status "Creating test branch: $TestBranch"
git checkout -b $TestBranch

# Step 6: Backup package files
Print-Status "Backing up package files..."
Copy-Item package.json package.json.backup
Copy-Item package-lock.json package-lock.json.backup

# Step 7: Update whatsapp-web.js
Write-Host ""
Write-Host "📦 Installing whatsapp-web.js@$LatestVersion..."
npm install whatsapp-web.js@latest

# Step 8: Show what changed
Write-Host ""
Write-Host "📝 Dependency Changes:" -ForegroundColor Cyan
git diff package.json

# Step 9: Check for breaking changes in changelog
Write-Host ""
Print-Warning "IMPORTANT: Check changelog for breaking changes"
Write-Host "   Changelog: https://github.com/pedroslopez/whatsapp-web.js/releases"
Write-Host ""
Read-Host "Press Enter to continue after reviewing changelog"

# Step 10: Run validation checks
Write-Host ""
Write-Host "🧪 Running Validation Checks..." -ForegroundColor Cyan

# Check if node_modules is healthy
Print-Status "Checking installation..."
npm ls whatsapp-web.js --depth=0

# Check for security issues
Write-Host ""
Print-Status "Running security audit..."
try {
    npm audit --production
} catch {
    Print-Warning "Security issues found - review SECURITY.md"
}

# Step 11: Test syntax
Write-Host ""
Print-Status "Validating syntax..."
node -c index.js
if ($LASTEXITCODE -ne 0) {
    Print-Error "Syntax validation failed!"
    exit 1
}

# Step 12: Instructions for manual testing
Write-Host ""
Write-Host "🧪 MANUAL TESTING REQUIRED" -ForegroundColor Yellow
Write-Host "=========================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please test the following:"
Write-Host "  1. Start the bot: npm start"
Write-Host "  2. Scan QR code and connect"
Write-Host "  3. Test valuation request workflow"
Write-Host "  4. Test valuation reply workflow"
Write-Host "  5. Test rate update workflows"
Write-Host "  6. Test message queue"
Write-Host "  7. Check dashboard functionality"
Write-Host "  8. Verify WebSocket connections"
Write-Host ""
Write-Host "Run this command in a new terminal:"
Write-Host "  npm start" -ForegroundColor Cyan
Write-Host ""
$TestResult = Read-Host "After testing, did everything work? (y/N)"

if ($TestResult -match '^[Yy]$') {
    # Success path
    Write-Host ""
    Print-Status "Great! Preparing to merge..."

    # Commit changes
    git add package.json package-lock.json
    git commit -m "Update whatsapp-web.js from $CurrentVersion to $LatestVersion

- Tested all workflows successfully
- No breaking changes detected
- Security audit reviewed

🤖 Generated with safe-update script"

    # Switch back to main
    git checkout main

    # Merge test branch
    Print-Status "Merging test branch into main..."
    git merge $TestBranch --no-ff -m "Merge whatsapp-web.js update to $LatestVersion"

    # Cleanup
    git branch -d $TestBranch
    Remove-Item package.json.backup -ErrorAction SilentlyContinue
    Remove-Item package-lock.json.backup -ErrorAction SilentlyContinue

    Write-Host ""
    Print-Status "Update completed successfully! ✨"
    Print-Status "You can now: git push origin main"

} else {
    # Failure path
    Write-Host ""
    Print-Error "Update failed or tests did not pass"
    Print-Warning "Rolling back changes..."

    # Restore backups
    Move-Item package.json.backup package.json -Force
    Move-Item package-lock.json.backup package-lock.json -Force
    npm install

    # Switch back to main
    git checkout main
    git branch -D $TestBranch

    Print-Warning "Rolled back to $CurrentVersion"
    Print-Warning "Check the changelog for breaking changes:"
    Write-Host "   https://github.com/pedroslopez/whatsapp-web.js/releases/tag/v$LatestVersion"
}

Write-Host ""
Write-Host "Done! 🎉" -ForegroundColor Green
