-- Fix platform admin check used by RLS policies (was incorrectly checking company_users.platform_admin)
CREATE OR REPLACE FUNCTION public.is_platform_admin_secure()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.active = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.platform_admin = true
        AND cu.active = true
    )
  );
$$;