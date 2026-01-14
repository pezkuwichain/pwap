-- ==================================================
-- Schema Compatibility Fix
-- ==================================================
-- This SQL adds missing columns to existing tables
-- to make them compatible with mobile app
-- ==================================================

-- 1. Add missing columns to forum_discussions
ALTER TABLE forum_discussions
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Update existing rows
UPDATE forum_discussions SET likes = 0 WHERE likes IS NULL;

-- 2. Add missing columns to forum_replies
ALTER TABLE forum_replies
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Update existing rows
UPDATE forum_replies SET likes = 0 WHERE likes IS NULL;

-- 3. Fix notifications table
-- Check if user_id exists and rename to user_address
DO $$
BEGIN
  -- If user_id exists, rename it to user_address
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN user_id TO user_address;
  END IF;

  -- If user_address still doesn't exist, add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'user_address'
  ) THEN
    ALTER TABLE notifications ADD COLUMN user_address VARCHAR(100);
  END IF;

  -- Add other missing columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'type'
  ) THEN
    ALTER TABLE notifications ADD COLUMN type VARCHAR(20) DEFAULT 'system';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'title'
  ) THEN
    ALTER TABLE notifications ADD COLUMN title VARCHAR(200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- ==================================================
-- Verify Fix
-- ==================================================

-- Check forum_discussions
SELECT 'forum_discussions' as table_name,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_name = 'forum_discussions'
  AND column_name IN ('likes', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- Check forum_replies
SELECT 'forum_replies' as table_name,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_name = 'forum_replies'
  AND column_name IN ('likes', 'created_at')
ORDER BY ordinal_position;

-- Check notifications
SELECT 'notifications' as table_name,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND column_name IN ('user_address', 'type', 'title', 'message', 'read', 'metadata', 'created_at')
ORDER BY ordinal_position;

-- ==================================================
-- SUCCESS MESSAGE
-- ==================================================

SELECT '✅ Schema compatibility fix complete!' as status;
SELECT 'Run check_schema_compatibility.cjs again to verify' as next_step;
