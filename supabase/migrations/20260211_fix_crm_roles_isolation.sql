-- Separate CRM roles from platform roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_role') THEN
    CREATE TYPE public.crm_role AS ENUM ('owner', 'team', 'manager');
  END IF;
END
$$;

ALTER TABLE public.company_users
  ADD COLUMN IF NOT EXISTS crm_role public.crm_role;

-- Backfill CRM roles without altering platform roles
UPDATE public.company_users
SET crm_role = CASE
  WHEN crm_role IS NOT NULL THEN crm_role
  WHEN role::text IN ('owner', 'team', 'manager') THEN role::text::public.crm_role
  WHEN role::text IN ('admin') THEN 'manager'::public.crm_role
  ELSE 'team'::public.crm_role
END
WHERE crm_role IS NULL;

ALTER TABLE public.company_users
  ALTER COLUMN crm_role SET DEFAULT 'team',
  ALTER COLUMN crm_role SET NOT NULL;

-- Use CRM role for CRM policies; fall back to platform role when needed
CREATE OR REPLACE FUNCTION public.crm_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    crm_role::text,
    CASE
      WHEN role::text IN ('admin', 'manager') THEN role::text
      ELSE 'team'
    END
  )
  FROM public.company_users
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$$;
