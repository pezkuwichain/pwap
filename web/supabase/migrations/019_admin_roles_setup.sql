-- =====================================================
-- Migration 019: Admin Roles Setup
-- Assigns admin roles for P2P dispute resolution
-- =====================================================

-- Super Admin: satoshiqazi@gmail.com
-- Full access to all admin functions including dispute resolution
INSERT INTO public.admin_roles (user_id, role, granted_by)
SELECT
  u.id,
  'super_admin',
  u.id
FROM auth.users u
WHERE u.email = 'satoshiqazi@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  role = 'super_admin',
  updated_at = NOW();

-- Moderator: info@pezkuwichain.io
-- Can view and resolve disputes
INSERT INTO public.admin_roles (user_id, role, granted_by)
SELECT
  u.id,
  'moderator',
  (SELECT id FROM auth.users WHERE email = 'satoshiqazi@gmail.com')
FROM auth.users u
WHERE u.email = 'info@pezkuwichain.io'
ON CONFLICT (user_id) DO UPDATE SET
  role = 'moderator',
  updated_at = NOW();

-- Verify the setup
DO $$
DECLARE
  v_super_admin_count INT;
  v_moderator_count INT;
BEGIN
  SELECT COUNT(*) INTO v_super_admin_count
  FROM admin_roles ar
  JOIN auth.users u ON ar.user_id = u.id
  WHERE u.email = 'satoshiqazi@gmail.com' AND ar.role = 'super_admin';

  SELECT COUNT(*) INTO v_moderator_count
  FROM admin_roles ar
  JOIN auth.users u ON ar.user_id = u.id
  WHERE u.email = 'info@pezkuwichain.io' AND ar.role = 'moderator';

  IF v_super_admin_count = 1 THEN
    RAISE NOTICE '✓ Super Admin assigned: satoshiqazi@gmail.com';
  ELSE
    RAISE WARNING '✗ Super Admin NOT found - user may not exist yet';
  END IF;

  IF v_moderator_count = 1 THEN
    RAISE NOTICE '✓ Moderator assigned: info@pezkuwichain.io';
  ELSE
    RAISE WARNING '✗ Moderator NOT found - user may not exist yet';
  END IF;
END $$;

COMMENT ON TABLE admin_roles IS 'Admin role assignments for P2P dispute resolution and platform management';
