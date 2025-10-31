-- Migration: Fix broadcast_messages table structure
-- Date: 2025-10-31
-- Description: Add send_order column and fix constraints for broadcast messages

-- Add send_order column (for ordering messages in the broadcast sequence)
ALTER TABLE broadcast_messages
ADD COLUMN IF NOT EXISTS send_order INTEGER;

-- Remove NOT NULL constraint from personalized_message (make it optional)
ALTER TABLE broadcast_messages
ALTER COLUMN personalized_message DROP NOT NULL;

-- Add index on send_order for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_broadcast_msg_send_order ON broadcast_messages(execution_id, send_order);

-- Add comments to document columns
COMMENT ON COLUMN broadcast_messages.send_order IS 'Order in which this message should be sent in the broadcast sequence';
COMMENT ON COLUMN broadcast_messages.personalized_message IS 'Personalized message content (optional, can be generated on-the-fly)';
