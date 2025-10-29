# WhatsApp Bot Upgrade Testing & Monitoring Checklist

## Upgrade Summary
- **Library**: whatsapp-web.js v1.28.0 → v1.34.1
- **Date**: 2025-10-29
- **Changes**: Critical anti-ban improvements + library upgrade

---

## Critical Changes Implemented

### 1. Session Break Fixes (CRITICAL)
- ✅ `SESSION_BREAK_INTERVAL`: 1 year → **4 hours**
- ✅ `SESSION_BREAK_DURATION`: 1 second → **5 minutes**

### 2. Message Ignoring (User Disabled)
- ✅ `IGNORE_PROBABILITY`: Set to **0** (disabled per user request)

### 3. Pattern Randomization
- ✅ Active hours randomized daily (±1 hour variation)
- ✅ Watchdog interval randomized (7-10 minutes)
- ✅ Memory check interval randomized (6-8 minutes)
- ✅ Self-ping interval randomized (5-7 minutes)

### 4. Per-Group Rate Limiting
- ✅ Max 20 messages per group per hour
- ✅ Group message tracking implemented

### 5. Advanced Human-Like Behaviors
- ✅ Weekend delay multiplier (1.5x slower)
- ✅ Day progress multiplier (slower as day progresses)
- ✅ Network variability simulation (3% probability)
- ✅ Random "away" states (5% probability, 15-45 min)

---

## Pre-Deployment Checklist

### Environment Preparation
- [ ] Backup current `.wwebjs_auth` directory
- [ ] Backup Supabase session data
- [ ] Verify environment variables are set:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `WHATSAPP_SESSION_ID`
  - [ ] `PORT`
  - [ ] `APP_URL` (optional)
- [ ] Review current git status
- [ ] Create git commit with changes

### Code Review
- [ ] Verify all HUMAN_CONFIG changes are correct
- [ ] Check HumanBehaviorManager class methods
- [ ] Review randomization logic in intervals
- [ ] Confirm per-group rate limiting logic
- [ ] Validate away state and network simulation

---

## Deployment Steps

### 1. Stop Current Bot (if running)
```bash
# Save current session before stopping
curl http://localhost:3000/save-session

# Stop the process (Ctrl+C or kill process)
```

### 2. Deploy Changes
```bash
# Pull latest changes (if from git)
git pull

# Install dependencies (already done)
npm install

# Verify whatsapp-web.js version
npm list whatsapp-web.js
# Should show: whatsapp-web.js@1.34.1
```

### 3. Start Bot
```bash
# Start with garbage collection enabled
npm start

# Or manually:
node --expose-gc index.js
```

---

## Post-Deployment Testing (24 Hours)

### Hour 1: Initial Authentication
- [ ] Bot starts without errors
- [ ] QR code generates correctly (if new session)
- [ ] Authentication completes successfully
- [ ] `ready` event fires (check logs for "✅ WhatsApp client is ready")
- [ ] Session saves to Supabase
- [ ] Dashboard accessible at http://localhost:3000

### Hour 2-4: Session Break Testing
- [ ] Monitor logs for session break behavior
- [ ] Expected: Break should occur after ~4 hours
- [ ] Verify: "😴 Starting human-like session break..." message
- [ ] Verify: Break lasts ~5 minutes
- [ ] Verify: "😊 Session break ended, resuming activity..." message

### Hours 1-24: Message Processing
- [ ] Incoming messages are processed
- [ ] Valuation requests detected and handled
- [ ] Valuation replies detected and handled
- [ ] Interest rate messages processed
- [ ] Message queue functioning with delays
- [ ] Typing indicators sent before messages
- [ ] Messages marked as read

### Rate Limiting Tests
- [ ] Hourly message limit enforced (80 messages/hour)
- [ ] Daily message limit enforced (680 messages/day)
- [ ] Per-group limit enforced (20 messages/group/hour)
- [ ] Rate limit messages appear in logs
- [ ] Bot skips messages when limits reached

### Pattern Randomization Tests
- [ ] Active hours vary daily (check logs for "🕐 Daily active hours updated")
- [ ] Watchdog runs at varied intervals (7-10 min)
- [ ] Memory checks run at varied intervals (6-8 min)
- [ ] Self-ping runs at varied intervals (5-7 min)

### Human Behavior Tests
- [ ] Weekend delay multiplier applies (if testing on weekend)
- [ ] Day progress multiplier applies (slower responses in evening)
- [ ] Network delays occasionally occur (check "🌐 Simulated network delay")
- [ ] Away states randomly activate (check "🚶 Going away")
- [ ] Away states end correctly (check "👋 Back from away state")

### Session Management
- [ ] Session saves periodically (check "💾 Periodic session save completed")
- [ ] Session saves only during active hours and not on break
- [ ] Session restores after restart
- [ ] Backup session created in Supabase

---

## Monitoring Checklist

### Real-Time Monitoring (First 24 Hours)

#### Every 2 Hours
- [ ] Check bot process is running: `ps aux | grep node`
- [ ] Check memory usage: Look for "🧠 Memory:" in logs
- [ ] Verify WhatsApp connection: `curl http://localhost:3000/health`
- [ ] Check for error messages in logs
- [ ] Verify message processing count

#### Health Endpoint Check
```bash
curl http://localhost:3000/health | jq
```
Expected response:
```json
{
  "status": "healthy",
  "whatsapp": {
    "state": "CONNECTED",
    "ready": true
  },
  "supabase": "CONNECTED",
  "humanBehavior": {
    "isOnBreak": false,
    "isActiveHours": true,
    "messageCount": { "hourly": X, "daily": Y }
  }
}
```

#### Human Status Check
```bash
curl http://localhost:3000/human-status | jq
```
Review:
- [ ] `isOnBreak` alternates correctly
- [ ] `isActiveHours` reflects current time
- [ ] `messageCount` increments appropriately
- [ ] `queueLength` shows pending messages

### Log Monitoring Patterns

#### Success Patterns (Good)
```
✅ WhatsApp client is ready
💾 Session saved to Supabase successfully
✅ Watchdog: client state is "CONNECTED"
📝 Message added to processing queue
💾 Periodic session save completed
🕐 Daily active hours updated
```

#### Warning Patterns (Monitor)
```
⚠️ Hourly message limit reached
📅 Daily message limit reached
⚠️ Group hourly message limit reached
⚠️ High memory usage detected
💤 Skipping session save (break time or inactive hours)
```

#### Error Patterns (Immediate Action)
```
❌ Auth failed
🚨 Watchdog error during state check
🚨 CRITICAL MEMORY USAGE!
Failed to save session
Client disconnected
```

---

## Performance Metrics

### Baseline Metrics (Before Upgrade)
Record for comparison:
- Average response time: ___________
- Messages processed per hour: ___________
- Memory usage (RSS): ___________
- Session save success rate: ___________
- Uptime between restarts: ___________

### Post-Upgrade Metrics (After 24 Hours)
- Average response time: ___________
- Messages processed per hour: ___________
- Memory usage (RSS): ___________
- Session save success rate: ___________
- Uptime between restarts: ___________
- Session breaks taken: ___________
- Away states triggered: ___________

### Comparison Analysis
- [ ] Response times within acceptable range
- [ ] Message processing consistent
- [ ] Memory usage stable or improved
- [ ] No increase in errors or crashes
- [ ] Session management working reliably

---

## Risk Indicators & Response Actions

### 🔴 CRITICAL - Immediate Action Required

#### WhatsApp Ban Warning
**Indicators:**
- Account restricted message from WhatsApp
- Cannot send messages
- Frequent disconnections
- QR code loops

**Actions:**
1. Immediately stop the bot
2. Wait 24-48 hours before restarting
3. Review message volume and patterns
4. Consider reducing rate limits further
5. Increase delay multipliers

#### Authentication Loop
**Indicators:**
- Repeatedly asks for QR code
- Authentication fails continuously
- Session not persisting

**Actions:**
1. Clear session from Supabase: `curl -X DELETE http://localhost:3000/clear-session`
2. Delete local `.wwebjs_auth` directory
3. Restart bot and rescan QR code
4. Verify session saves after authentication

#### Memory Crash
**Indicators:**
- Memory usage above 450MB consistently
- Bot crashes with out-of-memory errors
- Process killed by system

**Actions:**
1. Enable garbage collection (already enabled with `--expose-gc`)
2. Reduce `backupSyncIntervalMs` in RemoteAuth
3. Restart bot more frequently
4. Investigate memory leaks in custom workflows

### 🟡 WARNING - Monitor Closely

#### High Message Volume
**Indicators:**
- Rate limits hit frequently
- Queue length consistently high (>10)
- Processing delays increasing

**Actions:**
1. Review per-group message counts
2. Consider reducing `MAX_MESSAGES_PER_GROUP_PER_HOUR`
3. Add more groups to ignore list if needed
4. Monitor for specific high-volume groups

#### Inconsistent Session Saves
**Indicators:**
- "Failed to save session" errors
- Supabase connection errors
- Session data validation failures

**Actions:**
1. Check Supabase connectivity
2. Verify Supabase credentials
3. Check session data size
4. Review Supabase table structure

#### Pattern Detection Concerns
**Indicators:**
- WhatsApp showing verification requests
- Unusual behavior prompts
- Increased CAPTCHA requests

**Actions:**
1. Increase delay multipliers
2. Reduce message processing limits
3. Add more randomization to timing
4. Extend session break duration

### 🟢 NORMAL - No Action Required

#### Expected Behaviors
- Periodic session saves
- Rate limit warnings (occasional)
- Memory fluctuations (150-300MB)
- Weekend/evening slower responses
- Session breaks every ~4 hours
- Away states (5% of the time)

---

## Weekly Monitoring (Weeks 2-4)

### Week 2 Checklist
- [ ] Review 7-day message processing stats
- [ ] Check for any WhatsApp warnings or restrictions
- [ ] Analyze session break patterns
- [ ] Review error logs for recurring issues
- [ ] Verify group rate limiting effectiveness
- [ ] Compare performance to baseline

### Week 3 Checklist
- [ ] Long-term stability assessment
- [ ] Memory usage trends
- [ ] Session persistence reliability
- [ ] Rate limit adjustments if needed
- [ ] Review away state frequency
- [ ] Network delay simulation effectiveness

### Week 4 Checklist
- [ ] Final stability assessment
- [ ] Document any issues encountered
- [ ] Adjust configurations if needed
- [ ] Create backup of working session
- [ ] Plan for next update cycle

---

## Rollback Procedure

If critical issues occur:

### 1. Stop Current Bot
```bash
# Stop the process
# Save session if possible
curl http://localhost:3000/save-session
```

### 2. Revert Code Changes
```bash
# If using git
git revert HEAD
# Or restore from backup
```

### 3. Rollback package.json
```bash
npm install whatsapp-web.js@1.28.0
```

### 4. Restore Configuration
- Revert `HUMAN_CONFIG` changes in index.js
- Set `SESSION_BREAK_INTERVAL` back to 1 year (if needed)
- Set `SESSION_BREAK_DURATION` back to 1 second
- Remove new helper methods

### 5. Restart Bot
```bash
npm start
```

### 6. Verify Rollback
- [ ] Bot starts successfully
- [ ] Authentication works
- [ ] Messages process normally
- [ ] Session persists

---

## Success Criteria

After 24 hours, the upgrade is successful if:

- [x] ✅ Bot runs without crashes
- [x] ✅ Authentication persists across restarts
- [x] ✅ Messages process correctly
- [x] ✅ Session breaks occur at ~4 hour intervals
- [x] ✅ Rate limiting works as expected
- [x] ✅ No WhatsApp restrictions or warnings
- [x] ✅ Memory usage stable (<350MB)
- [x] ✅ Pattern randomization functioning
- [x] ✅ Human-like behaviors active
- [x] ✅ No critical errors in logs

---

## Additional Notes

### Known Limitations
- Session breaks may slightly delay message processing
- Away states might cause messages to queue
- Per-group rate limiting applies to all groups equally
- Weekend delay multiplier affects all operations

### Future Improvements
- Consider per-group custom rate limits
- Add time-of-day specific patterns
- Implement message priority system
- Add automated health checks
- Create alerting system for critical issues

### Support Resources
- whatsapp-web.js GitHub: https://github.com/pedroslopez/whatsapp-web.js
- Project documentation: README.md
- This checklist: UPGRADE_TESTING_CHECKLIST.md

---

## Testing Log

Date: ___________
Tester: ___________

### Test Results

| Test Category | Status | Notes |
|---------------|--------|-------|
| Authentication | ⬜ Pass ⬜ Fail | |
| Message Processing | ⬜ Pass ⬜ Fail | |
| Rate Limiting | ⬜ Pass ⬜ Fail | |
| Session Management | ⬜ Pass ⬜ Fail | |
| Human Behaviors | ⬜ Pass ⬜ Fail | |
| Memory Usage | ⬜ Pass ⬜ Fail | |
| Pattern Randomization | ⬜ Pass ⬜ Fail | |

### Issues Encountered
1. _______________________________________
2. _______________________________________
3. _______________________________________

### Resolution Actions
1. _______________________________________
2. _______________________________________
3. _______________________________________

### Final Recommendation
⬜ Approve for production
⬜ Requires additional testing
⬜ Recommend rollback

Signature: ___________
Date: ___________
