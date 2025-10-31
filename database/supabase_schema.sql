-- ===================================================================
-- SUPABASE DATABASE SCHEMA FOR WHATSAPP BOT
-- Replaces Google Sheets with proper database tables
-- ===================================================================

-- ===================================================================
-- TABLE 1: VALUATION REQUESTS (Replaces Valuation Google Sheet)
-- ===================================================================
CREATE TABLE IF NOT EXISTS valuation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WhatsApp message info
  group_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  message_id TEXT NOT NULL,

  -- Extracted valuation data
  address TEXT,
  property_type TEXT CHECK (property_type IN ('HDB', 'Condo', 'Landed', 'Apartment', NULL)),
  bedrooms INTEGER CHECK (bedrooms > 0),
  floor_area INTEGER CHECK (floor_area > 0),
  asking_price DECIMAL(15, 2),

  -- Original messages
  raw_message TEXT NOT NULL,
  reply_message TEXT,

  -- Metadata
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'replied', 'archived')),

  -- Notes and follow-up
  admin_notes TEXT,
  follow_up_date DATE,
  assigned_to TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_valuation_group ON valuation_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_valuation_sender ON valuation_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_valuation_status ON valuation_requests(status);
CREATE INDEX IF NOT EXISTS idx_valuation_created ON valuation_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_valuation_property_type ON valuation_requests(property_type);
CREATE INDEX IF NOT EXISTS idx_valuation_follow_up ON valuation_requests(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_valuation_requests_updated_at ON valuation_requests;
CREATE TRIGGER update_valuation_requests_updated_at
    BEFORE UPDATE ON valuation_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- TABLE 2: BROADCAST CONTACTS (Replaces Interest Rate Clients Sheet)
-- ===================================================================
CREATE TABLE IF NOT EXISTS broadcast_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,

  -- Grouping
  list_id UUID REFERENCES contact_lists(id) ON DELETE CASCADE,
  tags JSONB DEFAULT '[]'::jsonb,

  -- Custom fields
  tier TEXT CHECK (tier IN ('VIP', 'Premium', 'Standard', NULL)),
  preferred_contact TEXT DEFAULT 'whatsapp' CHECK (preferred_contact IN ('whatsapp', 'email', 'sms', 'phone')),
  custom_fields JSONB DEFAULT '{}'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_contacted_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_list ON broadcast_contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_phone ON broadcast_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_broadcast_active ON broadcast_contacts(is_active);
CREATE INDEX IF NOT EXISTS idx_broadcast_tier ON broadcast_contacts(tier);
CREATE INDEX IF NOT EXISTS idx_broadcast_tags ON broadcast_contacts USING GIN(tags);

-- Unique constraint: phone must be unique within a list
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_unique_phone_per_list
  ON broadcast_contacts(list_id, phone);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_broadcast_contacts_updated_at ON broadcast_contacts;
CREATE TRIGGER update_broadcast_contacts_updated_at
    BEFORE UPDATE ON broadcast_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- TABLE 3: BROADCAST EXECUTIONS (Replaces Progress Tracking in Sheets)
-- ===================================================================
CREATE TABLE IF NOT EXISTS broadcast_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Broadcast identification
  broadcast_id TEXT,
  name TEXT,

  -- Workflow reference
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,

  -- Message content
  message_content TEXT,
  message_template TEXT,
  image_url TEXT,

  -- Contact source
  contact_list_id UUID REFERENCES contact_lists(id) ON DELETE SET NULL,

  -- Progress tracking (replaces Clients!E2 in Google Sheets)
  total_contacts INTEGER NOT NULL,
  current_index INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- Batch info
  current_batch INTEGER DEFAULT 1,
  total_batches INTEGER,
  batch_size INTEGER DEFAULT 10,
  delay_between_messages INTEGER DEFAULT 7000, -- milliseconds
  delay_between_batches INTEGER DEFAULT 600000, -- milliseconds

  -- Notification
  notification_contact TEXT, -- Optional phone number for broadcast completion notifications

  -- Status
  status TEXT DEFAULT 'running' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  error_message TEXT,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_batch_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Statistics
  success_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE
      WHEN (sent_count + failed_count) > 0
      THEN ROUND((sent_count::DECIMAL / (sent_count + failed_count)) * 100, 2)
      ELSE 0
    END
  ) STORED
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_exec_workflow ON broadcast_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_exec_status ON broadcast_executions(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_exec_started ON broadcast_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_id ON broadcast_executions(broadcast_id);

-- ===================================================================
-- TABLE 4: BROADCAST MESSAGES (Individual Message Tracking)
-- ===================================================================
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  execution_id UUID REFERENCES broadcast_executions(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES broadcast_contacts(id) ON DELETE SET NULL,

  -- Recipient
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,

  -- Message
  personalized_message TEXT NOT NULL,
  image_url TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'delivered', 'read')),
  error_message TEXT,
  whatsapp_message_id TEXT,

  -- Timing
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_msg_execution ON broadcast_messages(execution_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_msg_contact ON broadcast_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_msg_status ON broadcast_messages(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_msg_sent ON broadcast_messages(sent_at DESC);

-- ===================================================================
-- TABLE 5: BROADCAST STATISTICS (Analytics & Reporting)
-- ===================================================================
CREATE TABLE IF NOT EXISTS broadcast_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  execution_id UUID REFERENCES broadcast_executions(id) ON DELETE CASCADE,

  -- Aggregate stats
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,

  -- Timing stats
  avg_delivery_time_seconds INTEGER,
  avg_read_time_seconds INTEGER,
  fastest_delivery_seconds INTEGER,
  slowest_delivery_seconds INTEGER,

  -- Cost tracking (if applicable)
  estimated_cost DECIMAL(10, 2),

  -- Timestamps
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- VIEWS FOR EASY QUERYING
-- ===================================================================

-- View: Recent Valuations with Full Details
CREATE OR REPLACE VIEW vw_recent_valuations AS
SELECT
  vr.id,
  vr.group_id,
  vr.sender_id,
  vr.address,
  vr.property_type,
  vr.bedrooms,
  vr.floor_area,
  vr.asking_price,
  vr.status,
  vr.admin_notes,
  vr.follow_up_date,
  vr.created_at,
  w.name as workflow_name
FROM valuation_requests vr
LEFT JOIN workflows w ON vr.workflow_id = w.id
ORDER BY vr.created_at DESC;

-- View: Active Broadcast Contacts by List
CREATE OR REPLACE VIEW vw_active_broadcast_contacts AS
SELECT
  bc.id,
  bc.name,
  bc.phone,
  bc.email,
  bc.tier,
  bc.is_active,
  bc.last_contacted_at,
  cl.name as list_name,
  cl.id as list_id
FROM broadcast_contacts bc
INNER JOIN contact_lists cl ON bc.list_id = cl.id
WHERE bc.is_active = true
ORDER BY bc.tier DESC, bc.name ASC;

-- View: Broadcast Execution Summary
CREATE OR REPLACE VIEW vw_broadcast_execution_summary AS
SELECT
  be.id,
  be.status,
  be.total_contacts,
  be.sent_count,
  be.failed_count,
  be.current_batch,
  be.total_batches,
  be.success_rate,
  be.started_at,
  be.completed_at,
  w.name as workflow_name,
  cl.name as contact_list_name,
  COUNT(bm.id) as total_messages
FROM broadcast_executions be
LEFT JOIN workflows w ON be.workflow_id = w.id
LEFT JOIN contact_lists cl ON be.contact_list_id = cl.id
LEFT JOIN broadcast_messages bm ON be.id = bm.execution_id
GROUP BY be.id, w.name, cl.name
ORDER BY be.started_at DESC;

-- ===================================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ===================================================================

-- Function: Get contacts for broadcast (with filtering)
CREATE OR REPLACE FUNCTION get_broadcast_contacts(
  p_list_id UUID,
  p_tier TEXT DEFAULT NULL,
  p_active_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  tier TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.name,
    bc.phone,
    bc.email,
    bc.tier
  FROM broadcast_contacts bc
  WHERE bc.list_id = p_list_id
    AND (p_tier IS NULL OR bc.tier = p_tier)
    AND (p_active_only = false OR bc.is_active = true)
  ORDER BY bc.tier DESC, bc.name ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: Update broadcast execution progress
CREATE OR REPLACE FUNCTION update_broadcast_progress(
  p_execution_id UUID,
  p_sent_count INTEGER,
  p_failed_count INTEGER,
  p_current_batch INTEGER,
  p_status TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE broadcast_executions
  SET
    sent_count = p_sent_count,
    failed_count = p_failed_count,
    current_batch = p_current_batch,
    current_index = p_sent_count + p_failed_count,
    last_sent_at = NOW(),
    status = COALESCE(p_status, status)
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Record broadcast message sent
CREATE OR REPLACE FUNCTION record_message_sent(
  p_execution_id UUID,
  p_contact_id UUID,
  p_recipient_name TEXT,
  p_recipient_phone TEXT,
  p_message TEXT,
  p_whatsapp_message_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
BEGIN
  INSERT INTO broadcast_messages (
    execution_id,
    contact_id,
    recipient_name,
    recipient_phone,
    personalized_message,
    status,
    whatsapp_message_id,
    sent_at
  )
  VALUES (
    p_execution_id,
    p_contact_id,
    p_recipient_name,
    p_recipient_phone,
    p_message,
    'sent',
    p_whatsapp_message_id,
    NOW()
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- ROW LEVEL SECURITY (RLS) - Optional, enable if needed
-- ===================================================================

-- Enable RLS on tables (commented out by default)
-- ALTER TABLE valuation_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE broadcast_contacts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE broadcast_executions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (uncomment and modify as needed)
-- CREATE POLICY "Allow admin full access to valuations"
--   ON valuation_requests FOR ALL
--   USING (auth.role() = 'admin');

-- ===================================================================
-- SEED DATA (Optional - for testing)
-- ===================================================================

-- Example: Create a default contact list for broadcast
INSERT INTO contact_lists (name, description, source, total_count)
VALUES (
  'Default Broadcast List',
  'Migrated contacts from Google Sheets',
  'google_sheets',
  0
)
ON CONFLICT DO NOTHING;

-- ===================================================================
-- CLEANUP FUNCTIONS
-- ===================================================================

-- Function: Archive old valuation requests (>90 days)
CREATE OR REPLACE FUNCTION archive_old_valuations()
RETURNS INTEGER AS $$
DECLARE
  v_archived_count INTEGER;
BEGIN
  UPDATE valuation_requests
  SET status = 'archived'
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND status != 'archived';

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Clean old broadcast messages (>30 days)
CREATE OR REPLACE FUNCTION cleanup_old_broadcast_messages()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM broadcast_messages
  WHERE sent_at < NOW() - INTERVAL '30 days'
    AND status IN ('sent', 'delivered', 'read');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- MIGRATION NOTES
-- ===================================================================

/*
MIGRATION CHECKLIST:

1. Run this SQL script in Supabase SQL Editor
2. Verify all tables created successfully
3. Run migration script to copy Google Sheets data
4. Update workflows to use Supabase instead of Google Sheets
5. Test workflows thoroughly
6. Deploy frontend Excel-like UI
7. Monitor for errors

GOOGLE SHEETS MAPPING:

Valuation Sheet (Valuations!A:K):
  A (Timestamp) → created_at
  B (GroupId) → group_id
  C (SenderId) → sender_id
  D (MessageId) → message_id
  E (Address) → address
  F (PropertyType) → property_type
  G (Bedrooms) → bedrooms
  H (FloorArea) → floor_area
  I (AskingPrice) → asking_price
  J (RawMessage) → raw_message
  K (ReplyMessage) → reply_message

Interest Rate Sheet (Clients!A:B):
  A (Name) → broadcast_contacts.name
  B (Phone) → broadcast_contacts.phone
  E2 (Progress Index) → broadcast_executions.current_index
  F2 (Message Content) → broadcast_executions.message_content
  H2 (Image URL) → broadcast_executions.image_url
*/
