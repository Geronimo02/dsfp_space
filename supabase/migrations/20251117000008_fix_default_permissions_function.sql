-- Fix create_default_role_permissions function to handle existing permissions correctly
-- The function needs to use the updated constraint with company_id

DROP FUNCTION IF EXISTS public.create_default_role_permissions() CASCADE;

CREATE OR REPLACE FUNCTION public.create_default_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Crear permisos para admin (todos los permisos en todos los módulos)
  -- Usar ON CONFLICT con la nueva constraint que incluye company_id
  INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES
    -- Admin permisos
    (NEW.id, 'admin', 'products', true, true, true, true, true),
    (NEW.id, 'admin', 'sales', true, true, true, true, true),
    (NEW.id, 'admin', 'customers', true, true, true, true, true),
    (NEW.id, 'admin', 'suppliers', true, true, true, true, true),
    (NEW.id, 'admin', 'purchases', true, true, true, true, true),
    (NEW.id, 'admin', 'reports', true, true, true, true, true),
    (NEW.id, 'admin', 'employees', true, true, true, true, true),
    (NEW.id, 'admin', 'settings', true, true, true, true, true),
    (NEW.id, 'admin', 'cash_register', true, true, true, true, true),
    (NEW.id, 'admin', 'technical_services', true, true, true, true, true),
    (NEW.id, 'admin', 'quotations', true, true, true, true, true),
    (NEW.id, 'admin', 'delivery_notes', true, true, true, true, true),
    (NEW.id, 'admin', 'promotions', true, true, true, true, true),
    (NEW.id, 'admin', 'returns', true, true, true, true, true),
    (NEW.id, 'admin', 'credit_notes', true, true, true, true, true),
    (NEW.id, 'admin', 'expenses', true, true, true, true, true),
    (NEW.id, 'admin', 'bulk_operations', true, true, true, true, true),
    (NEW.id, 'admin', 'pos_afip', true, true, true, true, true),
    -- Manager permisos
    (NEW.id, 'manager', 'products', true, true, true, false, true),
    (NEW.id, 'manager', 'sales', true, true, true, false, true),
    (NEW.id, 'manager', 'customers', true, true, true, false, true),
    (NEW.id, 'manager', 'suppliers', true, true, true, false, true),
    (NEW.id, 'manager', 'purchases', true, true, true, false, true),
    (NEW.id, 'manager', 'reports', true, false, false, false, true),
    (NEW.id, 'manager', 'cash_register', true, true, true, false, true),
    (NEW.id, 'manager', 'quotations', true, true, true, false, true),
    (NEW.id, 'manager', 'delivery_notes', true, true, true, false, true)
  ON CONFLICT (role, module, company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_default_role_permissions_trigger ON public.companies;
CREATE TRIGGER create_default_role_permissions_trigger
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_role_permissions();

COMMENT ON FUNCTION public.create_default_role_permissions() IS 'Creates default role permissions for a new company. Uses the updated constraint with company_id.';
