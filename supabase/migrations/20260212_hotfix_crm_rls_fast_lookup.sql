-- Hotfix: simplify CRM lookups to avoid timeouts (temporary)

-- Faster company lookup without ordering
CREATE OR REPLACE FUNCTION public.crm_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT company_id
  FROM public.company_users
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Faster role lookup without ordering
CREATE OR REPLACE FUNCTION public.crm_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT r.scope
      FROM public.company_users cu
      JOIN public.crm_roles r ON r.id = cu.crm_role_id
      WHERE cu.user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT COALESCE(cu.crm_role::text, CASE WHEN cu.role::text IN ('admin', 'manager') THEN cu.role::text ELSE 'team' END)
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      LIMIT 1
    )
  )
$$;

-- Faster permissions lookup without ordering
CREATE OR REPLACE FUNCTION public.crm_user_permissions()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN public.user_is_company_admin(public.crm_user_company_id()) THEN '{"can_view": true, "can_create": true, "can_edit": true, "can_delete": true}'::jsonb
    ELSE COALESCE(
      (
        SELECT r.permissions
        FROM public.company_users cu
        JOIN public.crm_roles r ON r.id = cu.crm_role_id
        WHERE cu.user_id = auth.uid()
        LIMIT 1
      ),
      CASE
        WHEN public.crm_user_role() IN ('owner', 'team') THEN '{"can_view": true, "can_create": true, "can_edit": true, "can_delete": false}'::jsonb
        ELSE '{"can_view": true, "can_create": true, "can_edit": false, "can_delete": false}'::jsonb
      END
    )
  END
$$;
