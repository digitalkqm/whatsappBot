-- Migration: Add notification_contact column to broadcast_executions table
-- Date: 2025-10-31
-- Description: Add optional phone number field for receiving broadcast completion notifications

-- Add notification_contact column if it doesn't exist
ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS notification_contact TEXT;

-- Add comment to document the column purpose
COMMENT ON COLUMN broadcast_executions.notification_contact IS 'Optional phone number to receive broadcast completion/failure notifications';
