-- =====================================================
-- REORGANIZACIÓN COMPLETA DEL SISTEMA DE MÓDULOS/FUNCIONES
-- =====================================================

-- 1. Agregar columnas para categorías y jerarquía
ALTER TABLE platform_modules 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS parent_module_id UUID REFERENCES platform_modules(id),
ADD COLUMN IF NOT EXISTS is_base BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS icon TEXT,
ADD COLUMN IF NOT EXISTS route TEXT;

-- 2. Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_platform_modules_category ON platform_modules(category);
CREATE INDEX IF NOT EXISTS idx_platform_modules_parent ON platform_modules(parent_module_id);
CREATE INDEX IF NOT EXISTS idx_platform_modules_is_base ON platform_modules(is_base);

-- 3. Actualizar módulos existentes con categorías
-- Dashboard (Base)
UPDATE platform_modules SET category = 'dashboard', is_base = true, display_order = 1, route = '/dashboard' WHERE code = 'dashboard';

-- POS (Base)
UPDATE platform_modules SET category = 'pos', is_base = true, display_order = 2, route = '/pos' WHERE code = 'pos';

-- Ventas
UPDATE platform_modules SET category = 'ventas', display_order = 10, route = '/sales' WHERE code = 'sales';
UPDATE platform_modules SET category = 'ventas', display_order = 11, route = '/quotations' WHERE code = 'quotations';
UPDATE platform_modules SET category = 'ventas', display_order = 13, route = '/returns' WHERE code = 'returns';
UPDATE platform_modules SET category = 'ventas', display_order = 14, route = '/reservations' WHERE code = 'reservations';

-- Clientes
UPDATE platform_modules SET category = 'clientes', display_order = 20, route = '/customers' WHERE code = 'customers';
UPDATE platform_modules SET category = 'clientes', display_order = 21, route = '/accounts-receivable' WHERE code = 'accounts_receivable';

-- Inventario
UPDATE platform_modules SET category = 'inventario', display_order = 30, route = '/products' WHERE code = 'products';
UPDATE platform_modules SET category = 'inventario', display_order = 31, route = '/inventory-alerts' WHERE code = 'inventory_alerts';
UPDATE platform_modules SET category = 'inventario', display_order = 32, route = '/warehouses' WHERE code = 'warehouses';

-- Compras
UPDATE platform_modules SET category = 'compras', display_order = 40, route = '/purchases' WHERE code = 'purchases';

-- Finanzas
UPDATE platform_modules SET category = 'finanzas', display_order = 50, route = '/bank-accounts' WHERE code = 'bank_accounts';
UPDATE platform_modules SET category = 'finanzas', display_order = 51, route = '/bank-movements' WHERE code = 'bank_movements';
UPDATE platform_modules SET category = 'finanzas', display_order = 52, route = '/card-movements' WHERE code = 'card_movements';
UPDATE platform_modules SET category = 'finanzas', display_order = 53, route = '/retentions' WHERE code = 'retentions';

-- Operaciones
UPDATE platform_modules SET category = 'operaciones', display_order = 60, route = '/technical-services' WHERE code = 'technical_services';
UPDATE platform_modules SET category = 'operaciones', display_order = 61, route = '/cash-register' WHERE code = 'cash_register';
UPDATE platform_modules SET category = 'operaciones', display_order = 62, route = '/expenses' WHERE code = 'expenses';
UPDATE platform_modules SET category = 'operaciones', display_order = 63, route = '/checks' WHERE code = 'checks';
UPDATE platform_modules SET category = 'operaciones', display_order = 64, route = '/promotions' WHERE code = 'promotions';

-- RRHH
UPDATE platform_modules SET category = 'rrhh', display_order = 70, route = '/payroll' WHERE code = 'payroll';
UPDATE platform_modules SET category = 'rrhh', display_order = 71, route = '/commissions' WHERE code = 'commissions';

-- Reportes
UPDATE platform_modules SET category = 'reportes', display_order = 80, route = '/reports' WHERE code = 'reports';
UPDATE platform_modules SET category = 'reportes', display_order = 81, route = '/accountant-reports' WHERE code = 'accountant_reports';

-- Administración
UPDATE platform_modules SET category = 'administracion', display_order = 90, route = '/settings' WHERE code = 'settings';
UPDATE platform_modules SET category = 'administracion', display_order = 92, route = '/audit-logs' WHERE code = 'audit_logs';
UPDATE platform_modules SET category = 'administracion', display_order = 93, route = '/access-logs' WHERE code = 'access_logs';
UPDATE platform_modules SET category = 'administracion', display_order = 94, route = '/monthly-closing' WHERE code = 'monthly_closing';
UPDATE platform_modules SET category = 'administracion', display_order = 95, route = '/bulk-operations' WHERE code = 'bulk_operations';
UPDATE platform_modules SET category = 'administracion', display_order = 96, route = '/notification-settings' WHERE code = 'notifications';

-- Integraciones
UPDATE platform_modules SET category = 'integraciones', display_order = 100, route = '/integrations' WHERE code = 'integrations';
UPDATE platform_modules SET category = 'integraciones', display_order = 101, route = '/pos-points' WHERE code = 'afip';

-- 4. Insertar módulos/funciones faltantes
-- Ventas - Remitos
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('delivery_notes', 'Remitos', 'Gestión de remitos y notas de entrega', 'ventas', 12, '/delivery-notes', 2000, 20400, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'ventas', 
  display_order = 12, 
  route = '/delivery-notes';

-- Inventario - Stock por Depósito
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('warehouse_stock', 'Stock por Depósito', 'Visualización de stock por depósito', 'inventario', 33, '/warehouse-stock', 2500, 25500, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'inventario', 
  display_order = 33, 
  route = '/warehouse-stock';

-- Inventario - Transferencias
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('warehouse_transfers', 'Transferencias', 'Transferencias entre depósitos', 'inventario', 34, '/warehouse-transfers', 2500, 25500, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'inventario', 
  display_order = 34, 
  route = '/warehouse-transfers';

-- Inventario - Reservas de Stock
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('stock_reservations', 'Reservas de Stock', 'Gestión de reservas de stock', 'inventario', 35, '/stock-reservations', 2000, 20400, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'inventario', 
  display_order = 35, 
  route = '/stock-reservations';

-- Compras - Órdenes de Compra
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('purchase_orders', 'Órdenes de Compra', 'Gestión de órdenes de compra', 'compras', 41, '/purchase-orders', 2500, 25500, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'compras', 
  display_order = 41, 
  route = '/purchase-orders';

-- Compras - Recepción de Mercadería
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('purchase_reception', 'Recepción de Mercadería', 'Recepción y control de mercadería', 'compras', 42, '/purchase-reception', 2500, 25500, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'compras', 
  display_order = 42, 
  route = '/purchase-reception';

-- Compras - Devoluciones a Proveedores
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('purchase_returns', 'Devoluciones a Proveedores', 'Gestión de devoluciones a proveedores', 'compras', 43, '/purchase-returns', 2000, 20400, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'compras', 
  display_order = 43, 
  route = '/purchase-returns';

-- Compras - Proveedores
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('suppliers', 'Proveedores', 'Gestión de proveedores', 'compras', 44, '/suppliers', 0, 0, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'compras', 
  display_order = 44, 
  route = '/suppliers';

-- Finanzas - Retenciones (si no existe)
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('retentions', 'Retenciones', 'Gestión de retenciones impositivas', 'finanzas', 53, '/retentions', 3000, 30600, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'finanzas', 
  display_order = 53, 
  route = '/retentions';

-- Clientes - Atención al Cliente
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('customer_support', 'Atención al Cliente', 'Sistema de tickets y soporte', 'clientes', 22, '/customer-support', 3500, 35700, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'clientes', 
  display_order = 22, 
  route = '/customer-support';

-- RRHH - Empleados/Usuarios
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('employees', 'Empleados', 'Gestión de empleados', 'rrhh', 72, '/employees', 2500, 25500, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'rrhh', 
  display_order = 72, 
  route = '/employees';

-- Administración - Punto de Venta AFIP
INSERT INTO platform_modules (code, name, description, category, display_order, route, price_monthly, price_annual, is_active)
VALUES ('pos_afip', 'Puntos de Venta AFIP', 'Configuración de puntos de venta AFIP', 'administracion', 91, '/pos-points', 0, 0, true)
ON CONFLICT (code) DO UPDATE SET 
  category = 'administracion', 
  display_order = 91, 
  route = '/pos-points';

-- 5. Marcar módulos base que no se pueden desactivar
UPDATE platform_modules SET is_base = true WHERE code IN ('dashboard', 'pos', 'sales', 'products', 'customers');

-- 6. Asegurar que POS y Sales existen
INSERT INTO platform_modules (code, name, description, category, is_base, display_order, route, price_monthly, price_annual, is_active)
VALUES 
  ('pos', 'Punto de Venta', 'Terminal de punto de venta', 'pos', true, 2, '/pos', 0, 0, true),
  ('sales', 'Ventas', 'Historial de ventas', 'ventas', true, 10, '/sales', 0, 0, true)
ON CONFLICT (code) DO UPDATE SET 
  is_base = true,
  price_monthly = 0,
  price_annual = 0;