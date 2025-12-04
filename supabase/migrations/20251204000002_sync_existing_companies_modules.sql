-- Migration: Sync existing companies with module system
-- This migration populates company_modules for existing companies
-- Date: 2025-12-04

-- =====================================================
-- 1. INSERT BASE MODULES FOR ALL EXISTING COMPANIES
-- =====================================================

-- Insert base modules (that should always be active) for all companies that don't have them yet
INSERT INTO company_modules (company_id, module_id, active, status, is_trial, activated_at)
SELECT 
  c.id as company_id,
  pm.id as module_id,
  true as active,
  'active' as status,
  false as is_trial,
  c.created_at as activated_at
FROM companies c
CROSS JOIN platform_modules pm
WHERE pm.is_base_module = true
AND NOT EXISTS (
  SELECT 1 
  FROM company_modules cm 
  WHERE cm.company_id = c.id 
  AND cm.module_id = pm.id
)
ON CONFLICT (company_id, module_id) DO NOTHING;

-- =====================================================
-- 2. INSERT ADDITIONAL MODULES FOR EXISTING COMPANIES
-- =====================================================

-- For companies that already exist, activate all additional modules they might be using
-- This is a one-time sync to transition from the old system to the new one
INSERT INTO company_modules (company_id, module_id, active, status, is_trial, activated_at)
SELECT 
  c.id as company_id,
  pm.id as module_id,
  true as active,
  'active' as status,
  false as is_trial,
  c.created_at as activated_at
FROM companies c
CROSS JOIN platform_modules pm
WHERE pm.is_base_module = false
AND pm.code IN (
  -- List of modules that existing companies should have active by default
  -- You can adjust this list based on your needs
  'sales', 'purchases', 'suppliers', 'reports', 'expenses', 
  'cash_register', 'warehouses', 'employees', 'payroll',
  'quotations', 'delivery_notes', 'bank_accounts', 'checks'
)
AND NOT EXISTS (
  SELECT 1 
  FROM company_modules cm 
  WHERE cm.company_id = c.id 
  AND cm.module_id = pm.id
)
ON CONFLICT (company_id, module_id) DO NOTHING;

-- =====================================================
-- 3. UPDATE EXISTING COMPANY_MODULES RECORDS
-- =====================================================

-- Ensure all existing company_modules have proper status
UPDATE company_modules
SET 
  status = CASE 
    WHEN status IS NULL AND active = true THEN 'active'
    WHEN status IS NULL AND active = false THEN 'suspended'
    ELSE status
  END,
  is_trial = COALESCE(is_trial, false),
  custom_limits = COALESCE(custom_limits, '{}'::jsonb)
WHERE status IS NULL OR is_trial IS NULL OR custom_limits IS NULL;

-- =====================================================
-- 4. LOG INITIAL ACTIVATIONS
-- =====================================================

-- Log the initial module activations for audit purposes
INSERT INTO module_change_history (
  company_id,
  module_id,
  action,
  changed_by,
  metadata,
  changed_at
)
SELECT 
  cm.company_id,
  cm.module_id,
  'activated' as action,
  NULL as changed_by,
  jsonb_build_object(
    'migration', 'initial_sync',
    'note', 'Automatic activation during migration to new module system'
  ) as metadata,
  cm.activated_at
FROM company_modules cm
WHERE NOT EXISTS (
  SELECT 1 
  FROM module_change_history mch 
  WHERE mch.company_id = cm.company_id 
  AND mch.module_id = cm.module_id
)
AND cm.active = true;

-- =====================================================
-- 5. VERIFY DATA INTEGRITY
-- =====================================================

-- Count companies without modules (should be 0)
DO $$
DECLARE
  companies_without_modules INT;
BEGIN
  SELECT COUNT(DISTINCT c.id)
  INTO companies_without_modules
  FROM companies c
  WHERE NOT EXISTS (
    SELECT 1 
    FROM company_modules cm 
    WHERE cm.company_id = c.id
  );
  
  IF companies_without_modules > 0 THEN
    RAISE WARNING 'Found % companies without any modules assigned', companies_without_modules;
  ELSE
    RAISE NOTICE 'All companies have modules assigned correctly';
  END IF;
END $$;

-- =====================================================
-- 6. SUMMARY REPORT
-- =====================================================

-- Show summary of modules per company
DO $$
DECLARE
  total_companies INT;
  total_modules INT;
  avg_modules_per_company NUMERIC;
BEGIN
  SELECT COUNT(DISTINCT company_id) INTO total_companies FROM company_modules;
  SELECT COUNT(*) INTO total_modules FROM company_modules;
  SELECT ROUND(AVG(module_count), 2) INTO avg_modules_per_company
  FROM (
    SELECT company_id, COUNT(*) as module_count
    FROM company_modules
    GROUP BY company_id
  ) subquery;
  
  RAISE NOTICE '=== Module System Sync Summary ===';
  RAISE NOTICE 'Total companies: %', total_companies;
  RAISE NOTICE 'Total module assignments: %', total_modules;
  RAISE NOTICE 'Average modules per company: %', avg_modules_per_company;
END $$;
