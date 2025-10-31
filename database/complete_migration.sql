-- Complete Migration for Broadcast System
-- Date: 2025-10-31
-- Description: All required changes to make the broadcast system work
-- Instructions: Run this in Supabase SQL Editor

-- ===================================================================
-- FIX 1: broadcast_executions table
-- ===================================================================

-- Add missing columns to broadcast_executions
ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS broadcast_id TEXT;

ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS message_template TEXT;

ALTER TABLE broadcast_executions
ADD COLUMN IF NOT EXISTS notification_contact TEXT;

-- Only drop NOT NULL if the column exists and is a table (not a view)
DO $$
BEGIN
  -- Check if message_content exists and is in a table (not a view)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'broadcast_executions'
    AND column_name = 'message_content'
    AND table_schema = 'public'
  ) THEN
    -- Make message_content nullable
    ALTER TABLE broadcast_executions
    ALTER COLUMN message_content DROP NOT NULL;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_broadcast_id ON broadcast_executions(broadcast_id);

-- ===================================================================
-- FIX 2: broadcast_messages table
-- ===================================================================

-- Add send_order column
ALTER TABLE broadcast_messages
ADD COLUMN IF NOT EXISTS send_order INTEGER;

-- Make personalized_message nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'broadcast_messages'
    AND column_name = 'personalized_message'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE broadcast_messages
    ALTER COLUMN personalized_message DROP NOT NULL;
  END IF;
END $$;

-- Add index for send order
CREATE INDEX IF NOT EXISTS idx_broadcast_msg_send_order ON broadcast_messages(execution_id, send_order);

-- ===================================================================
-- Done!
-- ===================================================================
-- You can now test the broadcast system
