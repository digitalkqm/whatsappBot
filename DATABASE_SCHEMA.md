# Database Schema for Workflow Builder

## Supabase Tables Setup

Run these SQL commands in your Supabase SQL Editor to create the required tables.

### 1. Workflows Table

Stores user-created workflows with their configuration and structure.

```sql
-- Drop existing table if you need to recreate
-- DROP TABLE IF EXISTS workflows CASCADE;

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,  -- 'keyword', 'schedule', 'manual', 'webhook'
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Node-based workflow structure
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
```

### 2. Message Templates Table

Stores reusable message templates with variable placeholders.

```sql
-- DROP TABLE IF EXISTS message_templates CASCADE;

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',  -- 'interest_rate', 'valuation', 'marketing', 'custom'
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,  -- Array of variable names: ["name", "phone", "address"]
  image_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,  -- Additional custom fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for category-based queries
CREATE INDEX IF NOT EXISTS idx_templates_category ON message_templates(category);
```

### 3. Contact Lists Table

Stores contact lists from various sources (manual, Google Sheets, CSV imports).

```sql
-- DROP TABLE IF EXISTS contact_lists CASCADE;

CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contacts JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of {name, phone, email, custom_fields}
  source TEXT DEFAULT 'manual',  -- 'manual', 'google_sheets', 'csv_import', 'whatsapp_groups'
  source_config JSONB DEFAULT '{}'::jsonb,  -- Configuration for syncing with source
  tags JSONB DEFAULT '[]'::jsonb,  -- Array of tags for organization
  total_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for source-based queries
CREATE INDEX IF NOT EXISTS idx_contact_lists_source ON contact_lists(source);
```

### 4. Workflow Executions Table

Tracks workflow execution history and results.

```sql
-- DROP TABLE IF EXISTS workflow_executions CASCADE;

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  trigger_data JSONB DEFAULT '{}'::jsonb,  -- Data that triggered the workflow
  execution_data JSONB DEFAULT '{}'::jsonb,  -- Step-by-step execution details
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  results JSONB DEFAULT '{}'::jsonb,  -- Final results and statistics
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for querying execution history
CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON workflow_executions(started_at DESC);
```

### 5. Workflow Execution Logs Table (Optional)

Detailed logs for each step in workflow execution.

```sql
-- DROP TABLE IF EXISTS workflow_execution_logs CASCADE;

CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,  -- Node ID from workflow_data
  step_type TEXT NOT NULL,  -- 'trigger', 'action', 'condition', etc.
  status TEXT DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for querying logs by execution
CREATE INDEX IF NOT EXISTS idx_logs_execution_id ON workflow_execution_logs(execution_id);
```

## Example Data Structures

### Workflow Data Structure

```json
{
  "nodes": [
    {
      "id": "node_1",
      "type": "trigger",
      "position": {"x": 100, "y": 100},
      "data": {
        "triggerType": "keyword",
        "keyword": "update rates",
        "matchType": "contains"
      }
    },
    {
      "id": "node_2",
      "type": "getTemplate",
      "position": {"x": 300, "y": 100},
      "data": {
        "templateId": "uuid-of-template"
      }
    },
    {
      "id": "node_3",
      "type": "getContacts",
      "position": {"x": 500, "y": 100},
      "data": {
        "contactListId": "uuid-of-contact-list"
      }
    },
    {
      "id": "node_4",
      "type": "loop",
      "position": {"x": 700, "y": 100},
      "data": {
        "items": "contacts",
        "batchSize": 10,
        "delayBetweenBatches": 600000
      }
    },
    {
      "id": "node_5",
      "type": "sendMessage",
      "position": {"x": 900, "y": 100},
      "data": {
        "templateId": "uuid-of-template",
        "to": "{{current_item.phone}}",
        "personalizeWith": {
          "name": "{{current_item.name}}"
        }
      }
    },
    {
      "id": "node_6",
      "type": "delay",
      "position": {"x": 1100, "y": 100},
      "data": {
        "seconds": 7
      }
    }
  ],
  "connections": [
    {"id": "c1", "source": "node_1", "target": "node_2"},
    {"id": "c2", "source": "node_2", "target": "node_3"},
    {"id": "c3", "source": "node_3", "target": "node_4"},
    {"id": "c4", "source": "node_4", "target": "node_5"},
    {"id": "c5", "source": "node_5", "target": "node_6"}
  ]
}
```

### Template Example

```json
{
  "id": "template_uuid",
  "name": "Interest Rate Update Template",
  "category": "interest_rate",
  "content": "Dear {{name}},\n\nLatest Interest Rates:\n{{rates}}\n\nBest regards,\nKeyquest Mortgage Team",
  "variables": ["name", "rates"],
  "image_url": "https://example.com/rates-image.jpg",
  "metadata": {
    "version": 1,
    "author": "admin"
  }
}
```

### Contact List Example

```json
{
  "id": "contacts_uuid",
  "name": "VIP Clients",
  "description": "High-value clients for priority updates",
  "contacts": [
    {
      "name": "John Doe",
      "phone": "6512345678",
      "email": "john@example.com",
      "custom_fields": {
        "tier": "VIP",
        "preferred_contact": "whatsapp"
      }
    },
    {
      "name": "Jane Smith",
      "phone": "6587654321",
      "email": "jane@example.com",
      "custom_fields": {
        "tier": "Premium"
      }
    }
  ],
  "source": "google_sheets",
  "source_config": {
    "spreadsheet_id": "abc123",
    "sheet_name": "Clients",
    "sync_interval": 3600
  },
  "tags": ["vip", "active", "2024"],
  "total_count": 2
}
```

## Migration Notes

1. **Preserve Existing Data**: The existing `whatsapp_sessions` and `workflow_state` tables remain unchanged.

2. **Backward Compatibility**: Hardcoded workflows (`interestRate.js`, `valuation.js`) continue to work alongside dynamic workflows.

3. **Data Validation**: All JSONB fields should be validated on the application layer before insertion.

4. **Cleanup Policy**: Consider implementing automatic cleanup of old execution logs (>30 days) to manage storage.

## Security Considerations

1. Enable Row Level Security (RLS) if needed:
```sql
-- Example RLS policy (adjust based on your auth setup)
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
```

2. Ensure proper indexing for performance with large datasets.

3. Implement validation layers in the application to prevent malicious workflow configurations.

4. Consider rate limiting on workflow execution to prevent abuse.
