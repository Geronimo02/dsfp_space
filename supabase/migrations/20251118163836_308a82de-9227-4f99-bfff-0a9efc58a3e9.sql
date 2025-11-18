-- Fix duplicate key violation in role_permissions by updating the pos_afip trigger
-- to handle conflicts gracefully

CREATE OR REPLACE FUNCTION public.create_pos_afip_permissions_for_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insertar permisos para el módulo pos_afip para la nueva empresa
  -- Usar ON CONFLICT para evitar duplicados si create_default_role_permissions ya los creó
  INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES 
    (NEW.id, 'admin', 'pos_afip', true, true, true, true, true),
    (NEW.id, 'manager', 'pos_afip', true, true, true, false, true),
    (NEW.id, 'accountant', 'pos_afip', true, false, false, false, true),
    (NEW.id, 'cashier', 'pos_afip', true, false, false, false, false),
    (NEW.id, 'employee', 'pos_afip', true, false, false, false, false),
    (NEW.id, 'warehouse', 'pos_afip', true, false, false, false, false)
  ON CONFLICT (role, module, company_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;