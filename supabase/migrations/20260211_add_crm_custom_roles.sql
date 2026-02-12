-- CRM custom roles with granular permissions

-- Custom roles table
CREATE TABLE IF NOT EXISTS public.crm_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('owner', 'team', 'manager')),
  permissions JSONB NOT NULL DEFAULT '{"can_view": true, "can_create": true, "can_edit": true, "can_delete": false}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_roles_company_name_idx
  ON public.crm_roles (company_id, lower(name));

-- Link users to custom CRM roles
ALTER TABLE public.company_users
  ADD COLUMN IF NOT EXISTS crm_role_id UUID REFERENCES public.crm_roles(id) ON DELETE SET NULL;

-- Helper: is company admin (platform role)
CREATE OR REPLACE FUNCTION public.user_is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = auth.uid()
      AND company_id = _company_id
      AND (role IN ('admin', 'manager') OR platform_admin = true)
  )
$$;

-- Update crm_user_role to use custom roles scope when present
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
      ORDER BY cu.created_at ASC
      LIMIT 1
    ),
    (
      SELECT COALESCE(cu.crm_role::text, CASE WHEN cu.role::text IN ('admin', 'manager') THEN cu.role::text ELSE 'team' END)
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      ORDER BY cu.created_at ASC
      LIMIT 1
    )
  )
$$;

-- Permissions for CRM actions
CREATE OR REPLACE FUNCTION public.crm_user_permissions()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT r.permissions
      FROM public.company_users cu
      JOIN public.crm_roles r ON r.id = cu.crm_role_id
      WHERE cu.user_id = auth.uid()
      ORDER BY cu.created_at ASC
      LIMIT 1
    ),
    CASE
      WHEN public.crm_user_role() IN ('admin', 'manager') THEN '{"can_view": true, "can_create": true, "can_edit": true, "can_delete": true}'::jsonb
      WHEN public.crm_user_role() IN ('owner', 'team') THEN '{"can_view": true, "can_create": true, "can_edit": true, "can_delete": false}'::jsonb
      ELSE '{"can_view": true, "can_create": true, "can_edit": false, "can_delete": false}'::jsonb
    END
  )
$$;

CREATE OR REPLACE FUNCTION public.crm_can_view_opportunity()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((public.crm_user_permissions() ->> 'can_view')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.crm_can_create_opportunity()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((public.crm_user_permissions() ->> 'can_create')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.crm_can_edit_opportunity()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((public.crm_user_permissions() ->> 'can_edit')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.crm_can_delete_opportunity()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((public.crm_user_permissions() ->> 'can_delete')::boolean, false)
$$;

-- Access check includes permission + scope
CREATE OR REPLACE FUNCTION public.crm_can_access_opportunity(opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN NOT public.crm_can_view_opportunity() THEN false
    WHEN public.crm_user_role() IN ('admin', 'manager') THEN true
    WHEN public.crm_user_role() = 'owner' THEN public.crm_is_owner_of_opportunity(opportunity_id)
    WHEN public.crm_user_role() = 'team' THEN true
    ELSE false
  END
$$;

-- RLS for custom roles table
ALTER TABLE public.crm_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM roles select by company" ON public.crm_roles;
DROP POLICY IF EXISTS "CRM roles insert by admin" ON public.crm_roles;
DROP POLICY IF EXISTS "CRM roles update by admin" ON public.crm_roles;
DROP POLICY IF EXISTS "CRM roles delete by admin" ON public.crm_roles;

CREATE POLICY "CRM roles select by company"
  ON public.crm_roles
  FOR SELECT
  TO authenticated
  USING (company_id = public.crm_user_company_id());

CREATE POLICY "CRM roles insert by admin"
  ON public.crm_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_company_admin(company_id));

CREATE POLICY "CRM roles update by admin"
  ON public.crm_roles
  FOR UPDATE
  TO authenticated
  USING (public.user_is_company_admin(company_id))
  WITH CHECK (public.user_is_company_admin(company_id));

CREATE POLICY "CRM roles delete by admin"
  ON public.crm_roles
  FOR DELETE
  TO authenticated
  USING (public.user_is_company_admin(company_id));

-- Update CRM opportunities policies to honor granular permissions
DROP POLICY IF EXISTS "CRM opportunities select by role" ON public.crm_opportunities;
DROP POLICY IF EXISTS "CRM opportunities insert by role" ON public.crm_opportunities;
DROP POLICY IF EXISTS "CRM opportunities update by role" ON public.crm_opportunities;
DROP POLICY IF EXISTS "CRM opportunities delete by role" ON public.crm_opportunities;

CREATE POLICY "CRM opportunities select by role"
  ON public.crm_opportunities
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(id)
  );

CREATE POLICY "CRM opportunities insert by role"
  ON public.crm_opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.crm_user_company_id()
    AND public.crm_can_create_opportunity()
  );

CREATE POLICY "CRM opportunities update by role"
  ON public.crm_opportunities
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(id)
    AND public.crm_can_edit_opportunity()
  )
  WITH CHECK (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(id)
    AND public.crm_can_edit_opportunity()
  );

CREATE POLICY "CRM opportunities delete by role"
  ON public.crm_opportunities
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_delete_opportunity()
  );
