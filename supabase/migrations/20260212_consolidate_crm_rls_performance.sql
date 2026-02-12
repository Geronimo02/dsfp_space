-- Consolidate CRM RLS performance fixes and final policy

-- Ensure supporting indexes
CREATE INDEX IF NOT EXISTS company_users_user_id_idx
  ON public.company_users (user_id);

CREATE INDEX IF NOT EXISTS company_users_user_company_idx
  ON public.company_users (user_id, company_id);

CREATE INDEX IF NOT EXISTS company_users_user_created_idx
  ON public.company_users (user_id, created_at);

CREATE INDEX IF NOT EXISTS crm_opportunities_company_owner_idx
  ON public.crm_opportunities (company_id, owner_id);

CREATE INDEX IF NOT EXISTS crm_opportunities_company_created_at_idx
  ON public.crm_opportunities (company_id, created_at DESC);

-- Fast lookup helpers (no ORDER BY to avoid timeouts)
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

-- Final select policy (admin bypass + owner check)
DROP POLICY IF EXISTS "CRM opportunities select by role" ON public.crm_opportunities;

CREATE POLICY "CRM opportunities select by role"
  ON public.crm_opportunities
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND (
      public.user_is_company_admin(public.crm_user_company_id())
      OR public.crm_user_role() IN ('admin','manager','team')
      OR (public.crm_user_role() = 'owner' AND owner_id = public.crm_user_employee_id())
    )
  );
