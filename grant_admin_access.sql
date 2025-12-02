-- Script para arreglar permisos RLS
-- Ejecuta esto después de aplicar fix_pricing_data.sql

-- 1. SOLUCIÓN: Permitir acceso a usuarios autenticados
DROP POLICY IF EXISTS "Authenticated users can view pricing config" ON platform_pricing_config;
CREATE POLICY "Authenticated users can view pricing config"
    ON platform_pricing_config FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view modules" ON platform_modules;
CREATE POLICY "Authenticated users can view modules"
    ON platform_modules FOR SELECT
    USING (auth.role() = 'authenticated');

-- 5. Verificar que ahora puedas ver la config
SELECT '✅ Verificación - Config visible:' as info;
SELECT * FROM platform_pricing_config LIMIT 1;

SELECT '✅ Verificación - Módulos visibles:' as info;
SELECT COUNT(*) as total_modulos FROM platform_modules;
