-- Migration: Add RLS policies for company_modules
-- Date: 2025-12-04
-- Purpose: Allow proper access control for company module management

-- =====================================================
-- RLS POLICIES FOR COMPANY_MODULES
-- =====================================================

-- Enable RLS if not already enabled
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate them properly)
DROP POLICY IF EXISTS "Platform admins can manage all company modules" ON company_modules;
DROP POLICY IF EXISTS "Users can view their company modules" ON company_modules;
DROP POLICY IF EXISTS "Company admins can manage their company modules" ON company_modules;

-- Policy 1: Platform admins can manage ALL company modules
CREATE POLICY "Platform admins can manage all company modules"
  ON company_modules FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Policy 2: Users can VIEW their company's modules
CREATE POLICY "Users can view their company modules"
  ON company_modules FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid() 
      AND active = true
    )
  );

-- Policy 3: Company admins can MANAGE their company's modules
CREATE POLICY "Company admins can manage their company modules"
  ON company_modules FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid() 
      AND active = true 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid() 
      AND active = true 
      AND role = 'admin'
    )
  );

-- =====================================================
-- HELPER FUNCTION: Check if user has company access
-- =====================================================

CREATE OR REPLACE FUNCTION user_has_company_access(user_id UUID, target_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM company_users cu
    WHERE cu.user_id = user_id
    AND cu.company_id = target_company_id
    AND cu.active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- POLICY COMMENTS
-- =====================================================

COMMENT ON POLICY "Platform admins can manage all company modules" ON company_modules IS
'Allows platform administrators to manage modules for any company';

COMMENT ON POLICY "Users can view their company modules" ON company_modules IS
'Allows employees to view what modules their company has active';

COMMENT ON POLICY "Company admins can manage their company modules" ON company_modules IS
'Allows company administrators with settings permissions to activate/deactivate modules';

COMMENT ON FUNCTION user_has_company_access(UUID, UUID) IS
'Helper function to check if a user belongs to a specific company';
