-- First, recreate the policy since the DROP was executed
-- We need to restore access temporarily while we fix the structure
-- But with a more restrictive policy using service_role only

-- Add company_id column to integration_secrets
ALTER TABLE public.integration_secrets 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Add created_at for audit
ALTER TABLE public.integration_secrets 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add updated_at for audit
ALTER TABLE public.integration_secrets 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add name/key identifier
ALTER TABLE public.integration_secrets 
ADD COLUMN IF NOT EXISTS key_name TEXT;

-- Now create secure policies
-- SELECT: Only users belonging to the company can view their company's secrets
CREATE POLICY "Company users can view their integration secrets"
ON public.integration_secrets
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL AND public.user_belongs_to_company(company_id)
);

-- INSERT: Only company admins can create new secrets
CREATE POLICY "Company admins can create integration secrets"
ON public.integration_secrets
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IS NOT NULL AND public.is_company_admin(company_id)
);

-- UPDATE: Only company admins can update secrets
CREATE POLICY "Company admins can update integration secrets"
ON public.integration_secrets
FOR UPDATE
TO authenticated
USING (company_id IS NOT NULL AND public.is_company_admin(company_id))
WITH CHECK (company_id IS NOT NULL AND public.is_company_admin(company_id));

-- DELETE: Only company admins can delete secrets
CREATE POLICY "Company admins can delete integration secrets"
ON public.integration_secrets
FOR DELETE
TO authenticated
USING (company_id IS NOT NULL AND public.is_company_admin(company_id));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_integration_secrets_company_id ON public.integration_secrets(company_id);