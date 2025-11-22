-- Configure accountant role permissions
-- First, let's create a function to setup accountant permissions for a company
CREATE OR REPLACE FUNCTION setup_accountant_permissions(company_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing accountant permissions for this company
  DELETE FROM role_permissions 
  WHERE role = 'accountant' AND company_id = company_uuid;
  
  -- Sales - view and export only
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES (company_uuid, 'accountant', 'sales', true, false, false, false, true);
  
  -- Purchases - view and export only
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES (company_uuid, 'accountant', 'purchases', true, false, false, false, true);
  
  -- Reports - view and export only
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES (company_uuid, 'accountant', 'reports', true, false, false, false, true);
  
  -- Expenses - view and export only
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES (company_uuid, 'accountant', 'expenses', true, false, false, false, true);
  
  -- Customers - view only (for account details)
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES (company_uuid, 'accountant', 'customers', true, false, false, false, true);
  
  -- Suppliers - view only
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES (company_uuid, 'accountant', 'suppliers', true, false, false, false, true);
  
  -- POS AFIP - view and export only
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES (company_uuid, 'accountant', 'pos_afip', true, false, false, false, true);
END;
$$;

-- Apply accountant permissions to all existing companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM companies WHERE active = true
  LOOP
    PERFORM setup_accountant_permissions(company_record.id);
  END LOOP;
END;
$$;