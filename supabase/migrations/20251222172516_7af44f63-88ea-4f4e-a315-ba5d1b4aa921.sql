-- Fix overly permissive RLS policies that allow cross-company data exposure
-- Affected tables: cash_registers, cash_movements, technical_services, warehouse_stock, warehouses

-- 1. Drop the overly permissive SELECT policies
DROP POLICY IF EXISTS "Anyone authenticated can view cash registers" ON cash_registers;
DROP POLICY IF EXISTS "Anyone authenticated can view cash movements" ON cash_movements;
DROP POLICY IF EXISTS "Anyone authenticated can view technical services" ON technical_services;
DROP POLICY IF EXISTS "Anyone authenticated can view warehouse stock" ON warehouse_stock;
DROP POLICY IF EXISTS "Anyone authenticated can view warehouses" ON warehouses;

-- 2. Create proper company-scoped SELECT policies

-- cash_registers: Users can only view cash registers from their company
CREATE POLICY "Users can view cash registers from their company"
ON cash_registers FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

-- cash_movements: Users can only view cash movements from their company
CREATE POLICY "Users can view cash movements from their company"
ON cash_movements FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

-- technical_services: Users can only view technical services from their company
CREATE POLICY "Users can view technical services from their company"
ON technical_services FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

-- warehouse_stock: Users can only view warehouse stock from their company
CREATE POLICY "Users can view warehouse stock from their company"
ON warehouse_stock FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

-- warehouses: Users can only view warehouses from their company
CREATE POLICY "Users can view warehouses from their company"
ON warehouses FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);