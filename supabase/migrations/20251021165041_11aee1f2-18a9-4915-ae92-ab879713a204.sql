-- =============================================
-- PASO 1: EXTENDER ENUM DE ROLES
-- =============================================

-- Agregar nuevos roles al enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';