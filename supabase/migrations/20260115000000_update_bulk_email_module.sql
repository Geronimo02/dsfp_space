-- =====================================================
-- ACTUALIZACIÓN MÓDULO ENVÍO DE CORREOS MASIVOS
-- =====================================================
-- Fecha: 2026-01-15
-- Descripción: Actualiza el módulo bulk_email con precio de $10,000 
-- y lo asigna a la categoría 'operaciones'

-- Actualizar el módulo bulk_email
UPDATE platform_modules 
SET 
  category = 'operaciones',
  display_order = 77,
  route = '/bulk-operations',
  price_monthly = 10000,
  price_annual = 102000,
  description = 'Envío masivo de emails a clientes',
  is_active = true
WHERE code = 'bulk_email';

-- Si el módulo no existe, crearlo
INSERT INTO platform_modules (
  code, 
  name, 
  description, 
  category, 
  display_order, 
  route, 
  price_monthly, 
  price_annual, 
  is_base, 
  is_active
)
VALUES (
  'bulk_email', 
  'Envío de Correos Masivos', 
  'Envío masivo de emails a clientes', 
  'operaciones', 
  77, 
  '/bulk-operations', 
  10000, 
  102000, 
  false, 
  true
)
ON CONFLICT (code) DO UPDATE SET 
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  route = EXCLUDED.route,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;
