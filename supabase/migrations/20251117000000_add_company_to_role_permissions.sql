-- Add company_id to role_permissions table
-- This allows role permissions to be scoped per company

-- Add company_id column (nullable at first)
ALTER TABLE public.role_permissions 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_company ON public.role_permissions(company_id);

-- Update unique constraint to include company_id (do this before inserting)
ALTER TABLE public.role_permissions 
DROP CONSTRAINT IF EXISTS role_permissions_role_module_key;

ALTER TABLE public.role_permissions 
DROP CONSTRAINT IF EXISTS role_permissions_role_module_company_key;

-- Update existing role_permissions to assign them to all companies
-- This ensures existing permissions continue to work
DO $$
DECLARE
  company_record RECORD;
  perm_record RECORD;
BEGIN
  -- For each company
  FOR company_record IN 
    SELECT id FROM public.companies WHERE active = true
  LOOP
    -- For each existing permission that doesn't have a company
    FOR perm_record IN
      SELECT id, role, module, can_view, can_create, can_edit, can_delete, can_export 
      FROM public.role_permissions 
      WHERE company_id IS NULL
    LOOP
      -- Check if this permission already exists for this company
      IF NOT EXISTS (
        SELECT 1 FROM public.role_permissions 
        WHERE role = perm_record.role 
          AND module = perm_record.module 
          AND company_id = company_record.id
      ) THEN
        -- Create a copy for this company
        INSERT INTO public.role_permissions (
          role, module, can_view, can_create, can_edit, can_delete, can_export, company_id
        ) VALUES (
          perm_record.role, 
          perm_record.module, 
          perm_record.can_view, 
          perm_record.can_create, 
          perm_record.can_edit, 
          perm_record.can_delete, 
          perm_record.can_export, 
          company_record.id
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Delete old permissions without company_id
DELETE FROM public.role_permissions WHERE company_id IS NULL;

-- Make company_id required going forward
ALTER TABLE public.role_permissions 
ALTER COLUMN company_id SET NOT NULL;

-- Add unique constraint with company_id
ALTER TABLE public.role_permissions 
ADD CONSTRAINT role_permissions_role_module_company_key 
UNIQUE (role, module, company_id);

-- Drop and recreate RLS policies for role_permissions
DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Everyone can view role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can view their company role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can manage their company role permissions" ON public.role_permissions;

-- Users can view role permissions for their companies
CREATE POLICY "Users can view their company role permissions"
  ON public.role_permissions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Admins can manage role permissions for their companies
CREATE POLICY "Admins can manage their company role permissions"
  ON public.role_permissions FOR ALL
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role = 'admin'
    )
  );
