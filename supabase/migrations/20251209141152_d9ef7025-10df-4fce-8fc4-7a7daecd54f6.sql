
-- Eliminar políticas problemáticas en company_users
DROP POLICY IF EXISTS "Company admins can manage company users" ON public.company_users;

-- Crear políticas separadas para cada operación (evitar ALL que es problemático)
CREATE POLICY "update_company_users_admin"
ON public.company_users
FOR UPDATE
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "delete_company_users_admin"
ON public.company_users
FOR DELETE
TO authenticated
USING (public.is_company_admin(company_id));

-- Platform admins también pueden gestionar company_users
CREATE POLICY "select_company_users_platform_admin"
ON public.company_users
FOR SELECT
TO authenticated
USING (public.is_platform_admin_secure());

CREATE POLICY "update_company_users_platform_admin"
ON public.company_users
FOR UPDATE
TO authenticated
USING (public.is_platform_admin_secure())
WITH CHECK (public.is_platform_admin_secure());

CREATE POLICY "delete_company_users_platform_admin"
ON public.company_users
FOR DELETE
TO authenticated
USING (public.is_platform_admin_secure());

-- Recrear función create_company_with_admin con SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  company_name text,
  company_tax_id text DEFAULT NULL,
  company_phone text DEFAULT NULL,
  company_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;
  
  -- Crear la empresa (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.companies (name, tax_id, phone, address, active, currency)
  VALUES (company_name, company_tax_id, company_phone, company_address, true, 'ARS')
  RETURNING id INTO new_company_id;
  
  -- Asignar el usuario como admin
  INSERT INTO public.company_users (user_id, company_id, role, active, platform_admin)
  VALUES (current_user_id, new_company_id, 'admin', true, false);
  
  -- Crear registro de onboarding
  INSERT INTO public.company_onboarding (company_id)
  VALUES (new_company_id)
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN new_company_id;
END;
$$;
