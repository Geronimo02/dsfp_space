
-- Drop old policies that use set-returning subqueries (causing the error)
DROP POLICY IF EXISTS "Company admins can delete modules" ON public.company_modules;
DROP POLICY IF EXISTS "Company admins can insert modules" ON public.company_modules;
DROP POLICY IF EXISTS "Company admins can update modules" ON public.company_modules;
DROP POLICY IF EXISTS "Platform admins can delete modules" ON public.company_modules;
DROP POLICY IF EXISTS "Platform admins can insert modules" ON public.company_modules;
DROP POLICY IF EXISTS "Platform admins can select modules" ON public.company_modules;
DROP POLICY IF EXISTS "Platform admins can update modules" ON public.company_modules;
DROP POLICY IF EXISTS "Users can read company modules" ON public.company_modules;

-- The scalar function-based policies remain:
-- - select_company_modules_company_user (uses user_belongs_to_company)
-- - select_company_modules_platform_admin (uses is_platform_admin_secure)
-- - insert_company_modules_company_admin (uses is_company_admin)
-- - insert_company_modules_platform_admin (uses is_platform_admin_secure)
-- - update_company_modules_company_admin (uses is_company_admin)
-- - update_company_modules_platform_admin (uses is_platform_admin_secure)
-- - delete_company_modules_company_admin (uses is_company_admin)
-- - delete_company_modules_platform_admin (uses is_platform_admin_secure)
