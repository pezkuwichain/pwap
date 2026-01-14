-- web/supabase/migrations/20260110120000_create_get_admins_function.sql

CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT ar.user_id
  FROM public.admin_roles AS ar
  WHERE ar.role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
