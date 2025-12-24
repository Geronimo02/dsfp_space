-- Eliminar políticas existentes en company_modules que causan el problema
DROP POLICY IF EXISTS "Company admins can manage modules" ON public.company_modules;
DROP POLICY IF EXISTS "Platform admins can manage all modules" ON public.company_modules;
DROP POLICY IF EXISTS "Users can view their company modules" ON public.company_modules;
DROP POLICY IF EXISTS "Company users can view their company modules" ON public.company_modules;
DROP POLICY IF EXISTS "Admins can manage company modules" ON public.company_modules;

-- Crear función segura para verificar si es admin de plataforma (scalar, no set-returning)
CREATE OR REPLACE FUNCTION public.is_platform_admin_secure()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = auth.uid()
      AND platform_admin = true
      AND active = true
  )
$$;

-- Crear función segura para verificar si usuario pertenece a una empresa
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(company_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = auth.uid()
      AND company_id = company_uuid
      AND active = true
  )
$$;

-- Crear función segura para verificar si es admin de empresa
CREATE OR REPLACE FUNCTION public.is_company_admin(company_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = auth.uid()
      AND company_id = company_uuid
      AND role = 'admin'
      AND active = true
  )
$$;

-- Políticas para SELECT (lectura)
CREATE POLICY "select_company_modules_platform_admin"
ON public.company_modules
FOR SELECT
TO authenticated
USING (public.is_platform_admin_secure());

CREATE POLICY "select_company_modules_company_user"
ON public.company_modules
FOR SELECT
TO authenticated
USING (public.user_belongs_to_company(company_id));

-- Políticas para INSERT
CREATE POLICY "insert_company_modules_platform_admin"
ON public.company_modules
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin_secure());

CREATE POLICY "insert_company_modules_company_admin"
ON public.company_modules
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_admin(company_id));

-- Políticas para UPDATE
CREATE POLICY "update_company_modules_platform_admin"
ON public.company_modules
FOR UPDATE
TO authenticated
USING (public.is_platform_admin_secure())
WITH CHECK (public.is_platform_admin_secure());

CREATE POLICY "update_company_modules_company_admin"
ON public.company_modules
FOR UPDATE
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));

-- Políticas para DELETE
CREATE POLICY "delete_company_modules_platform_admin"
ON public.company_modules
FOR DELETE
TO authenticated
USING (public.is_platform_admin_secure());

CREATE POLICY "delete_company_modules_company_admin"
ON public.company_modules
FOR DELETE
TO authenticated
USING (public.is_company_admin(company_id));