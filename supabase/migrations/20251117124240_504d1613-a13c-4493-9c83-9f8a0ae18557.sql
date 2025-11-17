-- ============================================
-- FIX: Crear permisos por defecto para rol admin
-- Esto asegura que todos los admins tengan permisos completos
-- ============================================

-- Función para crear permisos por defecto al crear una empresa
CREATE OR REPLACE FUNCTION public.create_default_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Crear permisos para admin (todos los permisos en todos los módulos)
  INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES
    -- Productos
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
    -- Manager
    (NEW.id, 'manager', 'products', true, true, true, false, true),
    (NEW.id, 'manager', 'sales', true, true, true, false, true),
    (NEW.id, 'manager', 'customers', true, true, true, false, true),
    (NEW.id, 'manager', 'suppliers', true, true, true, false, true),
    (NEW.id, 'manager', 'purchases', true, true, true, false, true),
    (NEW.id, 'manager', 'reports', true, false, false, false, true),
    (NEW.id, 'manager', 'cash_register', true, true, true, false, true)
  ON CONFLICT (company_id, role, module) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger para crear permisos al crear empresa
DROP TRIGGER IF EXISTS create_default_role_permissions_trigger ON public.companies;
CREATE TRIGGER create_default_role_permissions_trigger
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_role_permissions();

-- Crear permisos para empresas existentes que no los tienen
INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
SELECT 
  c.id,
  'admin',
  module_name,
  true, true, true, true, true
FROM companies c
CROSS JOIN (VALUES 
  ('products'), ('sales'), ('customers'), ('suppliers'), ('purchases'), 
  ('reports'), ('employees'), ('settings'), ('cash_register'), ('technical_services'),
  ('quotations'), ('delivery_notes'), ('promotions'), ('returns'), ('credit_notes'),
  ('expenses'), ('bulk_operations'), ('pos_afip')
) AS modules(module_name)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.company_id = c.id 
    AND rp.role = 'admin' 
    AND rp.module = module_name
)
ON CONFLICT (company_id, role, module) DO NOTHING;