# WhatsApp Bot - Workflow UI/UX Implementation Guide

## 📋 Table of Contents
1. [Current System Architecture](#current-system-architecture)
2. [Workflow Trigger System](#workflow-trigger-system)
3. [Template & Contact Management](#template--contact-management)
4. [Frontend UI/UX Design](#frontend-uiux-design)
5. [Implementation Steps](#implementation-steps)
6. [API Integration](#api-integration)
7. [User Flow Diagrams](#user-flow-diagrams)

---

## 1. Current System Architecture

### Backend Components
```
index.js (Main Server)
├── Express Server (Port 3000)
├── WhatsApp Client (whatsapp-web.js)
├── Workflow Engine (/workflows/engine.js)
├── APIs
│   ├── WorkflowAPI (/api/workflowAPI.js)
│   ├── TemplateAPI (/api/templateAPI.js)
│   └── ContactAPI (/api/contactAPI.js)
└── WebSocket Server (Real-time updates)
```

### Frontend Components (Existing)
```
/public
├── index.html - Dashboard
├── app.js - Dashboard logic
├── templates.html - Template manager
├── templates.js - Template logic
├── contacts.html - Contact manager
└── contacts.js - Contact logic
```

### Database (Supabase)
- `workflows` - Workflow configurations
- `templates` - Message templates
- `contact_lists` - Contact lists
- `workflow_executions` - Execution history
- `whatsapp_sessions` - Session data

---

## 2. Workflow Trigger System

### Current Trigger Words (index.js:1034-1072)
```javascript
// Detected in handleIncomingMessage()
1. "valuation request" → Triggers valuation workflow
2. "keyquest mortgage team" → Triggers interest_rate workflow
3. "update bank rates" → Triggers bank_rates_update workflow
```

### How Triggers Work
1. **Message Reception** (index.js:1001-1111)
   - Bot listens to group messages (`msg.from.endsWith('@g.us')`)
   - Checks message body and quoted messages for trigger words
   - Routes to appropriate workflow via `workflowEngine.executeWorkflow()`

2. **Workflow Execution Flow**
   ```
   Incoming Message
   → Trigger Detection (keyword matching)
   → Human Behavior Queue (delays, rate limiting)
   → Workflow Engine
   → Workflow Handler (interestRate.js/valuation.js)
   → Google Sheets Integration (contact data)
   → Batch Processing (10 contacts per batch)
   → WhatsApp Message Sending (/send-message endpoint)
   ```

3. **Current Workflow: Interest Rate** (workflows/interestRate.js)
   - Reads contact list from Google Sheets
   - Processes in batches of 10
   - 7-second delay between messages
   - 10-minute delay between batches
   - Updates progress in Google Sheets (index tracking)

---

## 3. Template & Contact Management

### Templates System (COMPLETE)
**Features:**
- ✅ Create/Edit/Delete templates
- ✅ Variable support: `{{variable_name}}`
- ✅ Categories: general, interest_rate, valuation, marketing, custom
- ✅ Image URL support
- ✅ Preview functionality
- ✅ Duplicate templates

**API Endpoints:**
```
POST   /api/templates/create
GET    /api/templates/list
GET    /api/templates/:id
PUT    /api/templates/:id/update
DELETE /api/templates/:id/delete
POST   /api/templates/:id/duplicate
POST   /api/templates/:id/preview
```

### Contacts System (COMPLETE)
**Features:**
- ✅ Manual contact entry
- ✅ CSV import
- ✅ Google Sheets sync
- ✅ WhatsApp group fetching
- ✅ Contact list management
- ✅ Statistics tracking

**API Endpoints:**
```
POST   /api/contacts/create
GET    /api/contacts/list
GET    /api/contacts/:id
PUT    /api/contacts/:id/update
DELETE /api/contacts/:id/delete
POST   /api/contacts/import/csv
POST   /api/contacts/sync/google-sheets
GET    /api/contacts/groups/whatsapp
```

### Workflows System (PARTIAL)
**Current State:**
- ✅ Workflow engine infrastructure
- ✅ Trigger-based execution
- ✅ Google Sheets integration
- ❌ **MISSING: Frontend UI for workflow builder**

**API Endpoints (Available but No UI):**
```
POST   /api/workflows/create
GET    /api/workflows/list
GET    /api/workflows/:id
PUT    /api/workflows/:id/update
DELETE /api/workflows/:id/delete
POST   /api/workflows/:id/toggle
POST   /api/workflows/:id/duplicate
GET    /api/workflows/:id/executions
```

---

## 4. Frontend UI/UX Design

### NEW PAGE: Workflow Builder (`workflows.html`)

#### Page Structure
```html
Header
├── Title: "⚙️ Workflow Builder"
├── Navigation: Dashboard | Templates | Contacts
└── Action Button: "+ Create Workflow"

Main Content
├── Active Workflows Section
│   ├── Workflow Cards (grid layout)
│   │   ├── Workflow Name & Description
│   │   ├── Trigger Type Badge
│   │   ├── Status Toggle (Active/Inactive)
│   │   ├── Actions: Edit | Duplicate | Delete | View History
│   │   └── Last Execution Info
│   └── Empty State: "Create your first workflow"
│
└── Workflow Statistics Section
    ├── Total Workflows
    ├── Active Workflows
    ├── Total Executions (Today/Week/Month)
    └── Success Rate
```

#### Workflow Creation Modal

**Step 1: Basic Information**
```
- Workflow Name (required)
- Description (optional)
- Trigger Type (dropdown):
  • Keyword Trigger
  • Schedule Trigger
  • Manual Trigger
  • Webhook Trigger
```

**Step 2: Configure Trigger**

For **Keyword Trigger**:
```
- Trigger Word/Phrase (text input)
  Example: "send interest rates"
- Case Sensitive (checkbox)
- Listen in Groups (multi-select):
  • All Groups
  • Specific Groups (group selector)
```

For **Schedule Trigger**:
```
- Schedule Type (dropdown):
  • Daily
  • Weekly
  • Monthly
  • Custom Cron
- Time Selection (time picker)
- Timezone (dropdown)
```

**Step 3: Select Template**
```
- Template Selector (searchable dropdown)
- Preview of selected template
- Variable mapping section:
  • Auto-detect variables from template
  • Map to contact fields or custom values
```

**Step 4: Select Recipients**
```
- Recipient Type (tabs):

  [Contact Lists] [WhatsApp Groups] [Custom]

  Contact Lists Tab:
  - Multi-select from existing contact lists
  - Show contact count for each list
  - Total recipients count

  WhatsApp Groups Tab:
  - Fetch connected groups from bot
  - Multi-select groups
  - Group member count display

  Custom Tab:
  - Manual phone number entry
  - CSV import option
```

**Step 5: Configure Options**
```
- Batch Settings:
  • Batch Size (slider: 1-50, default: 10)
  • Delay Between Messages (slider: 1-60 seconds, default: 7)
  • Delay Between Batches (slider: 1-60 minutes, default: 10)

- Image Attachment:
  • Image URL (text input)
  • Or upload image (file picker)
  • Image preview

- Advanced Options:
  • Skip duplicates (checkbox)
  • Stop on error (checkbox)
  • Send test message first (checkbox)
```

**Step 6: Review & Create**
```
- Summary of all settings
- Estimated completion time
- Estimated cost (if applicable)
- Preview sample message
- Create & Activate button
```

---

## 5. Implementation Steps

### Phase 1: Workflow Builder UI (Priority)

#### Files to Create:
1. **`/public/workflows.html`**
   ```html
   - Based on templates.html structure
   - Include modal for workflow creation
   - Workflow card grid layout
   - Execution history modal
   ```

2. **`/public/workflows.js`**
   ```javascript
   - Fetch and display workflows
   - Create/Edit/Delete workflows
   - Toggle active status
   - View execution history
   - Test workflow execution
   ```

3. **`/public/workflow-builder.js`** (Separate file for builder logic)
   ```javascript
   - Multi-step form management
   - Template selection and preview
   - Contact list integration
   - Variable mapping
   - Workflow validation
   ```

4. **`/public/styles.css`** (Add workflow-specific styles)
   ```css
   - Workflow card styles
   - Multi-step form styles
   - Variable mapping UI
   - Execution timeline styles
   ```

### Phase 2: Message Sending Interface

#### Option A: Standalone "Send Message" Page
```
/public/send-message.html
├── Quick Send Section
│   ├── Template Selector
│   ├── Recipient Selector (Contact Lists/Groups)
│   ├── Preview Panel
│   └── Send Button
├── Scheduled Messages Section
└── Message History
```

#### Option B: Integrated into Workflows
```
- Add "Send Now" action to workflow cards
- Quick send modal with:
  • Template selection
  • Recipient selection
  • Immediate execution
```

### Phase 3: Enhanced Trigger Management

#### Create Trigger Manager UI:
```
/public/triggers.html
├── Active Triggers List
│   ├── Keyword triggers with edit
│   ├── Schedule triggers with cron builder
│   └── Webhook triggers with URLs
├── Trigger Testing Tool
└── Trigger Analytics (most used, success rate)
```

---

## 6. API Integration

### Workflow Creation Example
```javascript
async function createWorkflow(workflowData) {
  const response = await fetch('/api/workflows/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Interest Rate Broadcast',
      description: 'Send interest rate updates to all clients',
      trigger_type: 'keyword',
      trigger_config: {
        keyword: 'send rates',
        case_sensitive: false,
        groups: ['all']
      },
      workflow_data: {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            config: { /* trigger config */ }
          },
          {
            id: 'template_1',
            type: 'template',
            config: {
              template_id: 'abc123',
              variables: {
                name: '{{contact.name}}',
                rate: '{{template.rate}}'
              }
            }
          },
          {
            id: 'send_1',
            type: 'send_message',
            config: {
              contact_list_ids: ['list1', 'list2'],
              batch_size: 10,
              delay_between: 7000,
              delay_batch: 600000
            }
          }
        ],
        connections: [
          { source: 'trigger_1', target: 'template_1' },
          { source: 'template_1', target: 'send_1' }
        ]
      },
      is_active: true
    })
  });

  return await response.json();
}
```

### Execute Workflow Example
```javascript
async function executeWorkflow(workflowId, overrides = {}) {
  const response = await fetch('/api/workflows/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow_id: workflowId,
      overrides: {
        template_variables: {
          rate: '3.5%',
          bank: 'DBS'
        },
        recipients: ['65xxxxxxxx', '65yyyyyyyy']
      }
    })
  });

  return await response.json();
}
```

---

## 7. User Flow Diagrams

### Flow 1: Create & Send Message Using Workflow

```
User Action                           System Response
───────────────────────────────────────────────────────────
1. Navigate to Workflows Page    →   Display active workflows
                                     + "Create Workflow" button

2. Click "Create Workflow"        →   Open multi-step modal
                                     Step 1: Basic Info

3. Enter name, description        →   Validate input
   Select "Keyword Trigger"          Show trigger config

4. Enter trigger word             →   Validate trigger word
   Select groups to listen          Save trigger config

5. Click "Next: Select Template"  →   Load templates list
                                     Show template preview

6. Select template                →   Auto-detect variables
   Preview message                   Show variable mapping

7. Map variables to fields        →   Validate mappings
   Click "Next: Recipients"          Load contact lists

8. Select contact lists           →   Calculate total recipients
   Or select WhatsApp groups         Show recipient count

9. Configure batch settings       →   Calculate estimated time
   Set delays, options               Show summary

10. Review summary                →   Validate workflow
    Click "Create Workflow"          Save to database

11. Workflow created              →   Show success message
    Option: "Activate Now"           Redirect to workflow list

12. Workflow appears in list      →   Listen for trigger word
    Status: Active ✅                Or manual execution

13. User sends trigger message    →   Detect keyword
    in WhatsApp group                Queue workflow execution

14. Workflow executes             →   Process batches
                                     Send messages
                                     Update progress

15. User views execution history  →   Show timeline
                                     Success/failure stats
                                     Individual message status
```

### Flow 2: Quick Send (Manual Trigger)

```
User Action                           System Response
───────────────────────────────────────────────────────────
1. Click "Send Message" button    →   Open quick send modal

2. Select template                →   Load template preview
                                     Show variables

3. Fill in variable values        →   Update preview in real-time
   Or use auto-fill from contacts

4. Select recipients              →   Show recipient count
   Contact lists/groups/custom

5. Optional: Attach image         →   Show image preview

6. Click "Send Now"               →   Validate all inputs
                                     Confirm action

7. Confirm send                   →   Create workflow execution
                                     Start sending messages

8. View progress                  →   Real-time progress bar
   Messages: 5/50 sent               Estimated time remaining

9. Execution complete             →   Show summary
                                     Success: 48/50
                                     Failed: 2 (with reasons)

10. View detailed report          →   Export to CSV option
                                     Retry failed option
```

### Flow 3: Workflow Triggered by Keyword

```
WhatsApp Message Flow                Backend Processing
───────────────────────────────────────────────────────────
1. User sends message             →   Bot receives message
   "send rates" in group             Extract message text

2. Bot detects trigger word       →   Match against active workflows
                                     Find matching workflow

3. Workflow found                 →   Load workflow config
   Type: Interest Rate Broadcast     Load template & recipients

4. Load template                  →   Replace variables
   "Dear {{name}}, rates: {{rate}}"  Get contact data

5. Process contact list           →   Batch contacts (10 per batch)
   50 contacts total                 Queue messages

6. Send batch 1 (contacts 1-10)   →   Send via /send-message endpoint
                                     7-second delay between each

7. Batch 1 complete               →   Update progress in database
                                     Wait 10 minutes

8. Send batch 2 (contacts 11-20)  →   Continue sending
   ... repeat for all batches        Track success/failure

9. All batches complete           →   Create execution record
                                     Store statistics

10. Notify group (optional)       →   Send summary message
    "Broadcast complete: 48/50"      Include execution ID
```

---

## 8. Key Features to Implement

### Must-Have Features (MVP)
- ✅ Template creation and management (DONE)
- ✅ Contact list management (DONE)
- ❌ **Workflow builder UI** (PRIORITY 1)
- ❌ **Quick send interface** (PRIORITY 2)
- ❌ Execution history viewer (PRIORITY 3)
- ❌ Real-time progress tracking (PRIORITY 4)

### Nice-to-Have Features
- Variable auto-fill from contact data
- Message preview with actual contact data
- A/B testing templates
- Scheduled workflows (cron-based)
- Webhook triggers
- Analytics dashboard
- Export execution reports (CSV/Excel)
- Message templates library (public templates)

### Advanced Features
- Visual workflow builder (drag-and-drop)
- Conditional logic (if-then-else)
- Multi-step workflows (sequences)
- Integration with other services (Zapier, Make.com)
- AI-powered template suggestions
- Sentiment analysis on responses
- Auto-reply based on keywords

---

## 9. Implementation Checklist

### Week 1: Workflow Builder Foundation
- [ ] Create `/public/workflows.html` (grid layout)
- [ ] Create `/public/workflows.js` (CRUD operations)
- [ ] Implement workflow card component
- [ ] Add navigation link in dashboard header
- [ ] Connect to existing workflow APIs

### Week 2: Workflow Creation Flow
- [ ] Build multi-step modal (6 steps)
- [ ] Implement template selector with preview
- [ ] Implement contact list selector
- [ ] Add variable mapping interface
- [ ] Add batch configuration options
- [ ] Create workflow validation logic

### Week 3: Execution & Monitoring
- [ ] Build execution history viewer
- [ ] Add real-time progress tracking (WebSocket)
- [ ] Implement execution detail modal
- [ ] Add retry failed messages feature
- [ ] Create execution export (CSV)

### Week 4: Quick Send & Polish
- [ ] Build quick send modal
- [ ] Add manual workflow execution
- [ ] Implement workflow testing tool
- [ ] Add workflow duplication feature
- [ ] Polish UI/UX, fix bugs
- [ ] Add tooltips and help text

---

## 10. Code Examples

### Workflow Card Component (HTML)
```html
<div class="workflow-card" data-workflow-id="{{id}}">
  <div class="workflow-header">
    <div class="workflow-info">
      <h3 class="workflow-name">{{name}}</h3>
      <p class="workflow-description">{{description}}</p>
    </div>
    <div class="workflow-status">
      <label class="toggle-switch">
        <input type="checkbox" {{#if is_active}}checked{{/if}}
               onchange="toggleWorkflow('{{id}}', this.checked)">
        <span class="slider"></span>
      </label>
    </div>
  </div>

  <div class="workflow-meta">
    <span class="trigger-badge">{{trigger_type}}</span>
    <span class="last-run">Last run: {{last_execution}}</span>
  </div>

  <div class="workflow-stats">
    <div class="stat">
      <span class="stat-value">{{execution_count}}</span>
      <span class="stat-label">Executions</span>
    </div>
    <div class="stat">
      <span class="stat-value">{{success_rate}}%</span>
      <span class="stat-label">Success Rate</span>
    </div>
  </div>

  <div class="workflow-actions">
    <button onclick="executeWorkflow('{{id}}')">▶️ Run Now</button>
    <button onclick="editWorkflow('{{id}}')">✏️ Edit</button>
    <button onclick="viewHistory('{{id}}')">📊 History</button>
    <button onclick="duplicateWorkflow('{{id}}')">📋 Duplicate</button>
    <button onclick="deleteWorkflow('{{id}}')">🗑️ Delete</button>
  </div>
</div>
```

### Execute Workflow with Progress (JavaScript)
```javascript
async function executeWorkflow(workflowId) {
  try {
    // Create execution
    const response = await fetch(`/api/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const { execution_id } = await response.json();

    // Show progress modal
    showProgressModal(execution_id);

    // Connect to WebSocket for real-time updates
    const ws = new WebSocket(`ws://localhost:3000/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'workflow_progress' && data.execution_id === execution_id) {
        updateProgressBar(data.progress);
        updateStatusText(data.current_step);
      }

      if (data.type === 'workflow_complete' && data.execution_id === execution_id) {
        showCompletionSummary(data.summary);
        ws.close();
      }
    };

  } catch (error) {
    showError('Failed to execute workflow: ' + error.message);
  }
}

function updateProgressBar(progress) {
  const bar = document.getElementById('progressBar');
  const text = document.getElementById('progressText');

  bar.style.width = progress.percentage + '%';
  text.textContent = `${progress.current}/${progress.total} messages sent`;
}
```

---

## 11. Summary

### Current State
- ✅ Backend infrastructure complete (workflows, templates, contacts)
- ✅ Template manager UI complete
- ✅ Contact manager UI complete
- ❌ Workflow builder UI missing (critical gap)
- ❌ Message sending UI missing

### What Needs to be Built

#### Priority 1: Workflow Builder (`/public/workflows.html`)
- List all workflows in card grid
- Create/edit workflow modal (multi-step)
- Template & contact selection
- Trigger configuration
- Batch settings

#### Priority 2: Quick Send Interface
- Standalone send message page OR
- Modal integrated into workflows
- Template selection with preview
- Recipient selection
- Immediate execution

#### Priority 3: Execution Monitoring
- Real-time progress tracking
- Execution history viewer
- Success/failure analytics
- Retry mechanism

### Expected User Journey (Final State)
```
1. User creates template → Templates Page ✅
2. User creates contact list → Contacts Page ✅
3. User creates workflow → Workflows Page ❌ (TO BUILD)
   - Select trigger (keyword/schedule/manual)
   - Select template
   - Select recipients
   - Configure batch settings
4. User activates workflow → Toggle in UI ❌ (TO BUILD)
5. User sends trigger message in WhatsApp → Backend ✅
6. Workflow executes automatically → Backend ✅
7. User monitors progress → Progress Modal ❌ (TO BUILD)
8. User reviews results → History Viewer ❌ (TO BUILD)
```

---

## 12. Next Steps

1. **Review this document** with the team
2. **Decide on UI framework** (Vanilla JS vs React vs Vue)
3. **Create design mockups** for workflow builder
4. **Implement Priority 1** (Workflow Builder UI)
5. **Test with existing workflows** (interest_rate, valuation)
6. **Iterate based on feedback**
7. **Add Priority 2 & 3 features**

---

**Document Version:** 1.0
**Last Updated:** 2025-10-03
**Author:** Claude Code Analysis
**Status:** Ready for Implementation
