-- =============================================
-- FIX DEFINITIVO: Reemplazar la policy que usa is_platform_admin_secure()
-- =============================================

-- Primero, ver qué policies existen
SELECT policyname FROM pg_policies WHERE tablename = 'platform_support_tickets';

-- Eliminar la que usa is_platform_admin_secure() que está rota
DROP POLICY IF EXISTS "select_platform_support_tickets_admin" ON platform_support_tickets;

-- Crear una nueva policy que funcione bien
CREATE POLICY "admin_can_select_all_tickets"
  ON platform_support_tickets
  FOR SELECT
  USING (
    -- El usuario está en platform_admins y está activo
    EXISTS (
      SELECT 1 
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.active = true
    )
  );

-- Verificar que la policy se creó
SELECT policyname FROM pg_policies WHERE tablename = 'platform_support_tickets' AND policyname LIKE '%admin%';

-- PRUEBA: Ver cuántos tickets ve el admin ahora
SELECT COUNT(*) as tickets_visibles FROM platform_support_tickets;
