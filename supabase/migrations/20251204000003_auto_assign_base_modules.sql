-- Migration: Auto-assign base modules to new companies
-- Date: 2025-12-04

-- =====================================================
-- FUNCTION: AUTO ASSIGN BASE MODULES TO NEW COMPANIES
-- =====================================================

CREATE OR REPLACE FUNCTION assign_base_modules_to_new_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert all base modules for the new company
  INSERT INTO company_modules (company_id, module_id, active, status, is_trial, activated_at)
  SELECT 
    NEW.id as company_id,
    pm.id as module_id,
    true as active,
    'active' as status,
    false as is_trial,
    NOW() as activated_at
  FROM platform_modules pm
  WHERE pm.is_base_module = true
  ON CONFLICT (company_id, module_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: ASSIGN BASE MODULES ON COMPANY CREATION
-- =====================================================

DROP TRIGGER IF EXISTS trigger_assign_base_modules_to_new_company ON companies;

CREATE TRIGGER trigger_assign_base_modules_to_new_company
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION assign_base_modules_to_new_company();

-- =====================================================
-- COMMENT
-- =====================================================

COMMENT ON FUNCTION assign_base_modules_to_new_company() IS 
'Automatically assigns all base modules to newly created companies';
