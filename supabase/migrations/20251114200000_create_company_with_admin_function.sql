-- ============================================
-- CREAR FUNCIÓN create_company_with_admin
-- Esta función falta y es la que causa el problema
-- ============================================

-- Eliminar función existente si tiene tipo de retorno diferente
DROP FUNCTION IF EXISTS public.create_company_with_admin(text, text, text, text);

-- Crear la función que crea una empresa y asigna al usuario como admin
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  company_name TEXT,
  company_tax_id TEXT DEFAULT NULL,
  company_phone TEXT DEFAULT NULL,
  company_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  current_user_id UUID;
BEGIN
  -- Obtener el usuario actual
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;
  
  -- Crear la empresa
  INSERT INTO public.companies (name, tax_id, phone, address, active, currency)
  VALUES (company_name, company_tax_id, company_phone, company_address, true, 'ARS')
  RETURNING id INTO new_company_id;
  
  -- Asignar el usuario como admin de la empresa
  INSERT INTO public.company_users (user_id, company_id, role, active)
  VALUES (current_user_id, new_company_id, 'admin', true);
  
  RETURN new_company_id;
END;
$$;

-- Dar permisos para que usuarios autenticados puedan ejecutar la función
GRANT EXECUTE ON FUNCTION public.create_company_with_admin TO authenticated;

-- Comentario descriptivo
COMMENT ON FUNCTION public.create_company_with_admin IS 'Crea una nueva empresa y asigna automáticamente al usuario actual como administrador';
