-- =============================================
-- Arreglar RLS en tabla companies para admin - CON TO AUTHENTICATED
-- =============================================

-- Limpiar TODAS las políticas existentes
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies WHERE tablename = 'companies'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.companies';
  END LOOP;
END $$;

-- ===== POLÍTICAS PARA PLATFORM ADMINS =====

-- Permitir que platform admins vean todas las companies
CREATE POLICY "admin_select_all_companies"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.platform_admins WHERE active = true
    )
  );

-- Permitir que platform admins actualicen empresas
CREATE POLICY "admin_update_companies"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.platform_admins WHERE active = true
    )
  );

-- Permitir que platform admins inserten empresas
CREATE POLICY "admin_insert_companies"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.platform_admins WHERE active = true
    )
  );

-- Permitir que platform admins eliminen empresas
CREATE POLICY "admin_delete_companies"
  ON public.companies
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.platform_admins WHERE active = true
    )
  );

-- ===== POLÍTICAS PARA COMPANY USERS (sus propias empresas) =====

-- Company users pueden ver su propia empresa
CREATE POLICY "company_users_select_own"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = companies.id
        AND cu.user_id = auth.uid()
        AND cu.active = true
    )
  );

-- Company users pueden actualizar su propia empresa
CREATE POLICY "company_users_update_own"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = companies.id
        AND cu.user_id = auth.uid()
        AND cu.active = true
    )
  );

-- Test: Ver cuántas companies ve el admin
SELECT COUNT(*) as companies_visibles FROM companies;

-- Test: Ver políticas finales
SELECT policyname FROM pg_policies WHERE tablename = 'companies' ORDER BY policyname;
