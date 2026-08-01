-- Migration: Drop remaining auth.users FK constraints missed in 20260223120000
-- These tables still reference auth.users(id) but use wallet-based UUID v5 identity

-- 1. p2p_messages.sender_id (blocks chat)
ALTER TABLE public.p2p_messages
  DROP CONSTRAINT IF EXISTS p2p_messages_sender_id_fkey;

-- 2. p2p_notifications.user_id (blocks notifications)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_notifications') THEN
    ALTER TABLE public.p2p_notifications DROP CONSTRAINT IF EXISTS p2p_notifications_user_id_fkey;
  END IF;
END $$;

-- 3. p2p_ratings.rater_id, rated_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_ratings') THEN
    ALTER TABLE public.p2p_ratings DROP CONSTRAINT IF EXISTS p2p_ratings_rater_id_fkey;
    ALTER TABLE public.p2p_ratings DROP CONSTRAINT IF EXISTS p2p_ratings_rated_id_fkey;
  END IF;
END $$;

-- 4. p2p_audit_log.user_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_audit_log') THEN
    ALTER TABLE public.p2p_audit_log DROP CONSTRAINT IF EXISTS p2p_audit_log_user_id_fkey;
  END IF;
END $$;

-- 5. Drop old auth.uid() RLS policy on p2p_messages (replaced by open policy)
DROP POLICY IF EXISTS "p2p_messages_trade_participants" ON public.p2p_messages;
