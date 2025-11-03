#!/bin/bash
# Safe WhatsApp-Web.js Update Script
# This script creates a test branch, updates, and validates before merging

set -e  # Exit on error

echo "🔄 WhatsApp-Web.js Safe Update Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Check current version
echo "📊 Current Configuration:"
CURRENT_VERSION=$(npm list whatsapp-web.js --depth=0 2>/dev/null | grep whatsapp-web.js | awk '{print $2}' | sed 's/@//g')
echo "   Current whatsapp-web.js: $CURRENT_VERSION"

# Step 2: Check for available updates
echo ""
echo "🔍 Checking for updates..."
LATEST_VERSION=$(npm view whatsapp-web.js version)
echo "   Latest available: $LATEST_VERSION"

if [ "$CURRENT_VERSION" == "$LATEST_VERSION" ]; then
    print_status "Already on latest version!"
    exit 0
fi

# Step 3: Ask for confirmation
echo ""
read -p "Update from $CURRENT_VERSION to $LATEST_VERSION? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Update cancelled"
    exit 0
fi

# Step 4: Create backup branch
BACKUP_BRANCH="backup-whatsapp-$(date +%Y%m%d-%H%M%S)"
print_status "Creating backup branch: $BACKUP_BRANCH"
git checkout -b "$BACKUP_BRANCH" 2>/dev/null || print_warning "Git backup failed - continuing anyway"

# Step 5: Create test branch
TEST_BRANCH="test-whatsapp-update-$LATEST_VERSION"
print_status "Creating test branch: $TEST_BRANCH"
git checkout -b "$TEST_BRANCH" 2>/dev/null

# Step 6: Backup package files
print_status "Backing up package files..."
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# Step 7: Update whatsapp-web.js
echo ""
echo "📦 Installing whatsapp-web.js@$LATEST_VERSION..."
npm install whatsapp-web.js@latest

# Step 8: Show what changed
echo ""
echo "📝 Dependency Changes:"
git diff package.json

# Step 9: Check for breaking changes in changelog
echo ""
print_warning "IMPORTANT: Check changelog for breaking changes"
echo "   Changelog: https://github.com/pedroslopez/whatsapp-web.js/releases"
echo ""
read -p "Press Enter to continue after reviewing changelog..."

# Step 10: Run validation checks
echo ""
echo "🧪 Running Validation Checks..."

# Check if node_modules is healthy
print_status "Checking installation..."
npm ls whatsapp-web.js --depth=0 || print_error "Installation check failed"

# Check for security issues
echo ""
print_status "Running security audit..."
npm audit --production || print_warning "Security issues found - review SECURITY.md"

# Step 11: Test syntax
echo ""
print_status "Validating syntax..."
node -c index.js || {
    print_error "Syntax validation failed!"
    exit 1
}

# Step 12: Instructions for manual testing
echo ""
echo "🧪 MANUAL TESTING REQUIRED"
echo "========================="
echo ""
echo "Please test the following:"
echo "  1. Start the bot: npm start"
echo "  2. Scan QR code and connect"
echo "  3. Test valuation request workflow"
echo "  4. Test valuation reply workflow"
echo "  5. Test rate update workflows"
echo "  6. Test message queue"
echo "  7. Check dashboard functionality"
echo "  8. Verify WebSocket connections"
echo ""
echo "Run these commands in a new terminal:"
echo "  npm start"
echo ""
read -p "After testing, did everything work? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Success path
    echo ""
    print_status "Great! Preparing to merge..."

    # Commit changes
    git add package.json package-lock.json
    git commit -m "Update whatsapp-web.js from $CURRENT_VERSION to $LATEST_VERSION

- Tested all workflows successfully
- No breaking changes detected
- Security audit reviewed

🤖 Generated with safe-update script" || print_warning "Nothing to commit"

    # Switch back to main
    git checkout main

    # Merge test branch
    print_status "Merging test branch into main..."
    git merge "$TEST_BRANCH" --no-ff -m "Merge whatsapp-web.js update to $LATEST_VERSION"

    # Cleanup
    git branch -d "$TEST_BRANCH"
    rm -f package.json.backup package-lock.json.backup

    echo ""
    print_status "Update completed successfully! ✨"
    print_status "You can now: git push origin main"

else
    # Failure path
    echo ""
    print_error "Update failed or tests did not pass"
    print_warning "Rolling back changes..."

    # Restore backups
    mv package.json.backup package.json
    mv package-lock.json.backup package-lock.json
    npm install

    # Switch back to main
    git checkout main
    git branch -D "$TEST_BRANCH"

    print_warning "Rolled back to $CURRENT_VERSION"
    print_warning "Check the changelog for breaking changes:"
    echo "   https://github.com/pedroslopez/whatsapp-web.js/releases/tag/v$LATEST_VERSION"
fi

echo ""
echo "Done! 🎉"
