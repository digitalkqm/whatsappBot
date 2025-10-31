-- Migration: Fix broadcast_executions table structure
-- Date: 2025-10-31
-- Description: Add missing columns and fix constraints for broadcast system

-- Add broadcast_id column (unique identifier for each broadcast)
ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS broadcast_id TEXT;

-- Add name column (friendly name for the broadcast)
ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS name TEXT;

-- Add message_template column (the message content used for broadcast)
ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS message_template TEXT;

-- Add notification_contact column (phone number for completion notifications)
ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS notification_contact TEXT;

-- Remove NOT NULL constraint from message_content (make it optional)
ALTER TABLE broadcast_executions
ALTER COLUMN message_content DROP NOT NULL;

-- Add index on broadcast_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_broadcast_id ON broadcast_executions(broadcast_id);

-- Add comments to document columns
COMMENT ON COLUMN broadcast_executions.broadcast_id IS 'Unique identifier for the broadcast (e.g., broadcast_1234567890_abc123)';
COMMENT ON COLUMN broadcast_executions.name IS 'Friendly name for the broadcast';
COMMENT ON COLUMN broadcast_executions.message_template IS 'Message template used for this broadcast';
COMMENT ON COLUMN broadcast_executions.message_content IS 'Message content (same as message_template, kept for compatibility)';
COMMENT ON COLUMN broadcast_executions.notification_contact IS 'Optional phone number to receive broadcast completion notifications';
