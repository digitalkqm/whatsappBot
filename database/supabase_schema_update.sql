-- ===================================================================
-- SUPABASE SCHEMA UPDATE - Add Banker Management
-- Run this AFTER running the initial supabase_schema.sql
-- ===================================================================

-- ===================================================================
-- TABLE: BANKERS (New)
-- ===================================================================
CREATE TABLE IF NOT EXISTS bankers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Banker info
  name TEXT NOT NULL UNIQUE, -- e.g., "Yvonne", "Ethan"
  display_name TEXT NOT NULL, -- Full name for UI display
  agent_number TEXT UNIQUE, -- Agent identifier (e.g., "AG001")

  -- Bank/Organization
  bank_name TEXT, -- e.g., "Premas", "DBS", "MBB", "OCBC"
  organization TEXT, -- Company/organization name

  -- WhatsApp integration
  whatsapp_group_id TEXT NOT NULL, -- Target group to forward valuations
  whatsapp_group_name TEXT, -- Display name of group

  -- Routing keywords (for auto-assignment)
  routing_keywords JSONB DEFAULT '[]'::jsonb, -- Array of keywords like ["yvonne", "premas"]

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher priority = checked first in routing

  -- Statistics
  total_valuations INTEGER DEFAULT 0,
  last_assigned_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for bankers
CREATE INDEX IF NOT EXISTS idx_bankers_active ON bankers(is_active);
CREATE INDEX IF NOT EXISTS idx_bankers_priority ON bankers(priority DESC);
CREATE INDEX IF NOT EXISTS idx_bankers_keywords ON bankers USING GIN(routing_keywords);
CREATE INDEX IF NOT EXISTS idx_bankers_bank ON bankers(bank_name);

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_bankers_updated_at
    BEFORE UPDATE ON bankers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- TABLE: BANKER_ROUTING_RULES (New)
-- ===================================================================
CREATE TABLE IF NOT EXISTS banker_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  banker_id UUID REFERENCES bankers(id) ON DELETE CASCADE,

  -- Routing configuration
  keyword TEXT NOT NULL,
  match_type TEXT DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact', 'regex')),
  priority INTEGER DEFAULT 0, -- Higher priority rules checked first

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for routing rules
CREATE INDEX IF NOT EXISTS idx_routing_banker ON banker_routing_rules(banker_id);
CREATE INDEX IF NOT EXISTS idx_routing_active ON banker_routing_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_routing_priority ON banker_routing_rules(priority DESC);

-- ===================================================================
-- UPDATE: VALUATION_REQUESTS (Add new columns)
-- ===================================================================

-- Add banker-related columns
ALTER TABLE valuation_requests
  -- Template fields (parsed from "Valuation Request:" template)
  ADD COLUMN IF NOT EXISTS size TEXT, -- e.g., "1200 sqft"
  ADD COLUMN IF NOT EXISTS asking TEXT, -- e.g., "$500,000"
  ADD COLUMN IF NOT EXISTS salesperson_name TEXT, -- Stored for records only
  ADD COLUMN IF NOT EXISTS agent_number TEXT, -- Formatted phone: "6591234567" (auto-formatted from template)
  ADD COLUMN IF NOT EXISTS agent_whatsapp_id TEXT, -- WhatsApp ID: "6591234567@c.us"
  ADD COLUMN IF NOT EXISTS banker_name_requested TEXT, -- Requested banker name from template

  -- Original request tracking
  ADD COLUMN IF NOT EXISTS request_message_id TEXT, -- Original request WhatsApp message ID
  ADD COLUMN IF NOT EXISTS requester_group_id TEXT, -- Where request came from

  -- Banker assignment (system assigned based on banker_name_requested)
  ADD COLUMN IF NOT EXISTS banker_id UUID REFERENCES bankers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS banker_name TEXT, -- Cached for display
  ADD COLUMN IF NOT EXISTS banker_agent_number TEXT, -- Banker's agent number (e.g., AG001, AG002)
  ADD COLUMN IF NOT EXISTS target_group_id TEXT, -- Banker's WhatsApp group

  -- Forwarding tracking (only Address, Size, Asking forwarded to banker)
  ADD COLUMN IF NOT EXISTS forwarded_to_banker BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS forward_message_id TEXT, -- CRITICAL: WhatsApp message ID sent to banker (used for linking reply)

  -- Acknowledgment tracking
  ADD COLUMN IF NOT EXISTS acknowledgment_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledgment_message_id TEXT,

  -- Banker reply tracking (TWO-WAY COMMUNICATION)
  ADD COLUMN IF NOT EXISTS banker_reply_message_id TEXT, -- Banker's reply WhatsApp message ID
  ADD COLUMN IF NOT EXISTS banker_reply_text TEXT, -- Banker's actual reply content
  ADD COLUMN IF NOT EXISTS banker_replied_at TIMESTAMP WITH TIME ZONE,

  -- Final reply to requester group (formatted: From Banker + Address, Size, Asking, Valuation)
  ADD COLUMN IF NOT EXISTS final_reply_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_reply_message_id TEXT, -- Reply forwarded back to requester group

  -- Agent notification (clean format: Address, Size, Asking, Valuation - no "From Banker" header)
  ADD COLUMN IF NOT EXISTS agent_notified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_notification_message_id TEXT, -- Message sent to agent's private WhatsApp

  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- New indexes for valuation_requests
CREATE INDEX IF NOT EXISTS idx_valuation_banker ON valuation_requests(banker_id);
CREATE INDEX IF NOT EXISTS idx_valuation_forwarded ON valuation_requests(forwarded_to_banker);
CREATE INDEX IF NOT EXISTS idx_valuation_ack_sent ON valuation_requests(acknowledgment_sent);

-- NEW: Indexes for two-way communication
CREATE INDEX IF NOT EXISTS idx_valuation_forward_msg ON valuation_requests(forward_message_id);
CREATE INDEX IF NOT EXISTS idx_valuation_target_group ON valuation_requests(target_group_id);
CREATE INDEX IF NOT EXISTS idx_valuation_final_reply ON valuation_requests(final_reply_sent);

-- ===================================================================
-- VIEWS (Updated)
-- ===================================================================

-- Drop and recreate view with new banker fields
DROP VIEW IF EXISTS vw_recent_valuations;

CREATE OR REPLACE VIEW vw_recent_valuations AS
SELECT
  vr.id,
  vr.group_id,
  vr.sender_id,
  vr.message_id,
  vr.address,
  vr.property_type,
  vr.bedrooms,
  vr.floor_area,
  vr.asking_price,
  vr.status,
  vr.admin_notes,
  vr.follow_up_date,

  -- Banker info
  vr.banker_id,
  vr.banker_name,
  vr.banker_agent_number,
  b.bank_name,
  b.whatsapp_group_name,

  -- Tracking
  vr.forwarded_to_banker,
  vr.forwarded_at,
  vr.acknowledgment_sent,
  vr.banker_replied_at,
  vr.final_reply_sent,
  vr.completed_at,

  -- Workflow
  w.name as workflow_name,

  -- Timestamps
  vr.created_at,
  vr.updated_at
FROM valuation_requests vr
LEFT JOIN workflows w ON vr.workflow_id = w.id
LEFT JOIN bankers b ON vr.banker_id = b.id
ORDER BY vr.created_at DESC;

-- New view: Banker performance
CREATE OR REPLACE VIEW vw_banker_performance AS
SELECT
  b.id,
  b.name,
  b.display_name,
  b.bank_name,
  b.is_active,
  COUNT(vr.id) as total_valuations,
  COUNT(CASE WHEN vr.forwarded_to_banker = true THEN 1 END) as forwarded_count,
  COUNT(CASE WHEN vr.acknowledgment_sent = true THEN 1 END) as acknowledged_count,
  COUNT(CASE WHEN vr.status = 'replied' THEN 1 END) as replied_count,
  MAX(vr.created_at) as last_valuation_date
FROM bankers b
LEFT JOIN valuation_requests vr ON b.id = vr.banker_id
GROUP BY b.id, b.name, b.display_name, b.bank_name, b.is_active
ORDER BY total_valuations DESC;

-- ===================================================================
-- FUNCTIONS (New)
-- ===================================================================

-- Function: Route message to banker based on keywords
CREATE OR REPLACE FUNCTION route_to_banker(p_message_text TEXT)
RETURNS UUID AS $$
DECLARE
  v_banker_id UUID;
  v_lower_text TEXT;
BEGIN
  v_lower_text := LOWER(p_message_text);

  -- Find banker by routing keywords (highest priority first)
  SELECT b.id INTO v_banker_id
  FROM bankers b
  WHERE b.is_active = true
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(b.routing_keywords) AS keyword
      WHERE v_lower_text LIKE '%' || LOWER(keyword) || '%'
    )
  ORDER BY b.priority DESC, b.created_at ASC
  LIMIT 1;

  -- If no match, return first active banker
  IF v_banker_id IS NULL THEN
    SELECT id INTO v_banker_id
    FROM bankers
    WHERE is_active = true
    ORDER BY priority DESC, created_at ASC
    LIMIT 1;
  END IF;

  RETURN v_banker_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment banker valuation count
CREATE OR REPLACE FUNCTION increment_banker_valuation_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.banker_id IS NOT NULL THEN
    UPDATE bankers
    SET
      total_valuations = total_valuations + 1,
      last_assigned_at = NOW()
    WHERE id = NEW.banker_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment banker stats
CREATE TRIGGER trigger_increment_banker_stats
    AFTER INSERT ON valuation_requests
    FOR EACH ROW
    EXECUTE FUNCTION increment_banker_valuation_count();

-- ===================================================================
-- SEED DATA - Initial Bankers (from n8n workflow)
-- ===================================================================

-- Insert bankers from n8n workflow
INSERT INTO bankers (name, display_name, agent_number, bank_name, whatsapp_group_id, whatsapp_group_name, routing_keywords, priority, is_active)
VALUES
  -- Premas
  ('Yvonne', 'Yvonne', 'AG001', 'Premas', '6596440186-1598498077@g.us', 'Premas Group', '["yvonne", "premas"]'::jsonb, 10, true),

  -- DBS
  ('Ethan', 'Ethan', 'AG002', 'DBS', '120363026214257477@g.us', 'DBS Group', '["ethan", "dbs"]'::jsonb, 9, true),

  -- MBB (Maybank)
  ('Hui Hui', 'Hui Hui', 'AG003', 'MBB', '120363156244588807@g.us', 'MBB Hui Hui', '["hui hui", "huihui", "mbb hui"]'::jsonb, 8, true),
  ('Vikram', 'Vikram', 'AG004', 'MBB', '120363216496983099@g.us', 'MBB Vikram', '["vikram", "mbb vikram"]'::jsonb, 7, true),
  ('April', 'April', 'AG011', 'MBB', '6596440186-1532139636@g.us', 'MBB April', '["april", "mbb april"]'::jsonb, 6, true),

  -- OCBC
  ('Eunice', 'Eunice', 'AG005', 'OCBC', '120363399758119890@g.us', 'OCBC Eunice', '["eunice", "ocbc eunice"]'::jsonb, 8, true),
  ('Jewel', 'Jewel', 'AG009', 'OCBC', '120363410164822147@g.us', 'OCBC Jewel', '["jewel", "ocbc jewel"]'::jsonb, 7, true),
  ('Eunice Ong', 'Eunice Ong', 'AG012', 'OCBC', '6596440186-1614324984@g.us', 'OCBC Eunice Ong', '["eunice ong", "ong"]'::jsonb, 6, true),
  ('Eunice Boon', 'Eunice Boon', 'AG013', 'OCBC', '6596440186-1614324984@g.us', 'OCBC Eunice Boon', '["eunice boon", "boon"]'::jsonb, 5, true),

  -- SCB (Standard Chartered)
  ('Ying Feng', 'Ying Feng', 'AG006', 'SCB', '6596440186-1533216750@g.us', 'SCB Ying Feng', '["ying feng", "yingfeng", "scb", "standard chartered"]'::jsonb, 7, true),

  -- UOB
  ('Bret', 'Bret', 'AG007', 'UOB', '6596440186-1587618823@g.us', 'UOB Bret', '["bret", "uob bret"]'::jsonb, 7, true),
  ('Xin Jie', 'Xin Jie', 'AG008', 'UOB', '120363416304945643@g.us', 'UOB Xin Jie', '["xin jie", "xinjie", "uob xin"]'::jsonb, 6, true),
  ('James', 'James', 'AG010', 'UOB', '120363215516608216@g.us', 'UOB James', '["james", "uob james"]'::jsonb, 6, true),

  -- Bot Testing
  ('Nat', 'Nat (Bot Testing)', 'AG999', 'Testing', '120363026214257477@g.us', 'Bot Testing', '["nat", "testing", "bot", "test"]'::jsonb, 1, true)
ON CONFLICT (name) DO NOTHING;

-- ===================================================================
-- NOTES FOR USER
-- ===================================================================

/*
✅ SCHEMA UPDATE COMPLETE

Next steps:
1. Replace 'REPLACE_WITH_GROUP_ID' with actual WhatsApp group IDs from your n8n workflow
2. Update the routing_keywords arrays if needed
3. Test the route_to_banker() function with sample messages

To find group IDs from n8n workflow:
- Look for "groupId" values in the "Send to [Banker Name]" nodes
- Update each banker record with the correct group ID

Example:
UPDATE bankers SET whatsapp_group_id = '120363026214257477@g.us' WHERE name = 'Hui Hui';
*/
