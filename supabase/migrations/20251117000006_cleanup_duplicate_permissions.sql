-- Clean up any duplicate role_permissions before fixing the function
-- This handles the case where permissions were created with old constraint

-- First, identify and keep only one record per (role, module, company_id) combination
-- Delete older duplicates keeping the most recent one
DELETE FROM public.role_permissions rp1
WHERE EXISTS (
  SELECT 1 FROM public.role_permissions rp2
  WHERE rp2.role = rp1.role
    AND rp2.module = rp1.module
    AND rp2.company_id = rp1.company_id
    AND rp2.id > rp1.id  -- Keep the newer one (higher UUID)
);

-- Log how many we cleaned
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % duplicate role_permissions records', cleaned_count;
END $$;
