-- ========================================
-- APLICAR MIGRACIÓN COMPLETA DEL SISTEMA DE PRECIOS MODULAR
-- Ejecuta esto en Supabase SQL Editor
-- ========================================

-- 1. Crear tabla de configuración de precios
CREATE TABLE IF NOT EXISTS platform_pricing_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_package_price_monthly DECIMAL(10,2) NOT NULL DEFAULT 15000.00,
    base_package_price_annual DECIMAL(10,2) NOT NULL DEFAULT 153000.00,
    annual_discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    invoice_volume_tiers JSONB NOT NULL DEFAULT '[
        {"min": 0, "max": 100, "price": 0},
        {"min": 101, "max": 500, "price": 5000},
        {"min": 501, "max": 1000, "price": 10000},
        {"min": 1001, "max": null, "price": 20000}
    ]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insertar configuración inicial
INSERT INTO platform_pricing_config (id, base_package_price_monthly, base_package_price_annual, annual_discount_percentage) 
VALUES ('00000000-0000-0000-0000-000000000001', 15000.00, 153000.00, 15.00)
ON CONFLICT (id) DO UPDATE SET
    base_package_price_monthly = 15000.00,
    base_package_price_annual = 153000.00,
    annual_discount_percentage = 15.00;

-- 3. Crear tabla de módulos
CREATE TABLE IF NOT EXISTS platform_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_annual DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_base_module BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Insertar todos los módulos (43 módulos completos)
INSERT INTO platform_modules (code, name, description, price_monthly, price_annual, is_base_module, display_order) VALUES
    -- MÓDULOS BASE (6)
    ('dashboard', 'Dashboard', 'Panel principal con métricas y estadísticas', 0, 0, TRUE, 1),
    ('pos', 'Punto de Venta', 'Sistema de punto de venta integrado', 0, 0, TRUE, 2),
    ('products', 'Productos', 'Gestión de catálogo de productos', 0, 0, TRUE, 3),
    ('sales', 'Ventas', 'Gestión de ventas y facturación', 0, 0, TRUE, 4),
    ('customers', 'Clientes', 'Administración de clientes', 0, 0, TRUE, 5),
    ('settings', 'Configuración', 'Configuración avanzada del sistema', 0, 0, TRUE, 79),
    
    -- VENTAS & CLIENTES (5)
    ('quotations', 'Presupuestos', 'Creación y gestión de presupuestos', 2000, 20400, FALSE, 10),
    ('delivery_notes', 'Remitos', 'Gestión de remitos de entrega', 2000, 20400, FALSE, 11),
    ('returns', 'Devoluciones', 'Gestión de devoluciones de productos', 2000, 20400, FALSE, 12),
    ('reservations', 'Reservas', 'Sistema de reservas de productos/servicios', 2500, 25500, FALSE, 13),
    ('accounts_receivable', 'Cuentas Corrientes', 'Gestión de cuentas corrientes de clientes', 3000, 30600, FALSE, 14),
    
    -- INVENTARIO & COMPRAS (7)
    ('inventory_alerts', 'Alertas de Inventario', 'Notificaciones automáticas de stock bajo', 1500, 15300, FALSE, 20),
    ('warehouses', 'Depósitos', 'Gestión de múltiples depósitos', 3500, 35700, FALSE, 21),
    ('warehouse_stock', 'Stock por Depósito', 'Control de stock por ubicación', 3000, 30600, FALSE, 22),
    ('warehouse_transfers', 'Transferencias', 'Transferencias entre depósitos', 2500, 25500, FALSE, 23),
    ('stock_reservations', 'Reservas de Stock', 'Reservas de stock para pedidos', 2000, 20400, FALSE, 24),
    ('purchases', 'Compras', 'Gestión de órdenes de compra', 3000, 30600, FALSE, 25),
    ('suppliers', 'Proveedores', 'Administración de proveedores', 2000, 20400, FALSE, 26),
    
    -- GESTIÓN (7)
    ('technical_services', 'Servicios Técnicos', 'Gestión de servicios técnicos y reparaciones', 4000, 40800, FALSE, 30),
    ('promotions', 'Promociones', 'Creación y gestión de promociones', 2500, 25500, FALSE, 31),
    ('cash_register', 'Gestión de Caja', 'Control de caja y movimientos diarios', 2500, 25500, FALSE, 32),
    ('checks', 'Cheques', 'Control y gestión de cheques', 2000, 20400, FALSE, 33),
    ('expenses', 'Gastos', 'Control de gastos operativos', 2500, 25500, FALSE, 34),
    ('commissions', 'Comisiones', 'Cálculo y gestión de comisiones', 3000, 30600, FALSE, 35),
    ('employees', 'Usuarios', 'Administración de usuarios y permisos', 3000, 30600, FALSE, 36),
    
    -- TESORERÍA (4)
    ('bank_accounts', 'Cuentas Bancarias', 'Gestión de cuentas bancarias', 3000, 30600, FALSE, 40),
    ('bank_movements', 'Movimientos Bancarios', 'Control de movimientos bancarios', 3000, 30600, FALSE, 41),
    ('card_movements', 'Movimientos de Tarjetas', 'Control de movimientos con tarjetas', 3000, 30600, FALSE, 42),
    ('retentions', 'Retenciones', 'Gestión de retenciones fiscales', 2500, 25500, FALSE, 43),
    
    -- INTEGRACIONES (1)
    ('integrations', 'Integraciones', 'Integraciones con sistemas externos', 5000, 51000, FALSE, 50),
    
    -- RRHH (1)
    ('payroll', 'Liquidaciones', 'Gestión de liquidaciones de sueldos', 5000, 51000, FALSE, 60),
    
    -- REPORTES & ADMIN (9)
    ('reports', 'Reportes', 'Reportes avanzados y análisis', 4000, 40800, FALSE, 70),
    ('monthly_closing', 'Cierre Mensual', 'Cierre contable mensual', 3500, 35700, FALSE, 71),
    ('accountant_reports', 'Reportes Contador', 'Reportes específicos para contadores', 4000, 40800, FALSE, 72),
    ('ai_assistant', 'Asistente IA', 'Asistente inteligente con IA', 6000, 61200, FALSE, 73),
    ('audit_logs', 'Auditoría', 'Registro de auditoría de acciones', 2500, 25500, FALSE, 74),
    ('access_logs', 'Logs de Acceso', 'Registro de accesos al sistema', 2000, 20400, FALSE, 75),
    ('bulk_operations', 'Operaciones Masivas', 'Operaciones en lote', 3000, 30600, FALSE, 76),
    ('afip_pos_points', 'Puntos de Venta AFIP', 'Gestión de puntos de venta AFIP', 8000, 81600, FALSE, 77),
    ('notifications', 'Notificaciones', 'Sistema de notificaciones personalizadas', 2000, 20400, FALSE, 78)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_annual = EXCLUDED.price_annual,
    is_base_module = EXCLUDED.is_base_module,
    display_order = EXCLUDED.display_order;

-- 5. Crear tabla de módulos por empresa
CREATE TABLE IF NOT EXISTS company_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, module_id)
);

-- 6. Crear índices
CREATE INDEX IF NOT EXISTS idx_company_modules_company ON company_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_module ON company_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_active ON company_modules(active);

-- 7. RLS Policies
ALTER TABLE platform_pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;

-- Políticas para platform_pricing_config
DROP POLICY IF EXISTS "Platform admins can view pricing config" ON platform_pricing_config;
CREATE POLICY "Platform admins can view pricing config"
    ON platform_pricing_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE id = auth.uid() AND role = 'platform_admin'
        )
    );

DROP POLICY IF EXISTS "Platform admins can update pricing config" ON platform_pricing_config;
CREATE POLICY "Platform admins can update pricing config"
    ON platform_pricing_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE id = auth.uid() AND role = 'platform_admin'
        )
    );

-- Políticas para platform_modules
DROP POLICY IF EXISTS "Platform admins can manage modules" ON platform_modules;
CREATE POLICY "Platform admins can manage modules"
    ON platform_modules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE id = auth.uid() AND role = 'platform_admin'
        )
    );

DROP POLICY IF EXISTS "Users can view active modules" ON platform_modules;
CREATE POLICY "Users can view active modules"
    ON platform_modules FOR SELECT
    USING (is_active = TRUE);

-- Políticas para company_modules
DROP POLICY IF EXISTS "Platform admins can manage company modules" ON company_modules;
CREATE POLICY "Platform admins can manage company modules"
    ON company_modules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE id = auth.uid() AND role = 'platform_admin'
        )
    );

DROP POLICY IF EXISTS "Users can view their company modules" ON company_modules;
CREATE POLICY "Users can view their company modules"
    ON company_modules FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM employees WHERE id = auth.uid()
        )
    );

-- 8. Verificar resultados
SELECT '✅ CONFIGURACIÓN CREADA:' as status;
SELECT * FROM platform_pricing_config;

SELECT '✅ MÓDULOS CREADOS (' || COUNT(*)::text || ' total):' as status FROM platform_modules;
SELECT code, name, price_monthly, price_annual, is_base_module 
FROM platform_modules 
ORDER BY display_order
LIMIT 10;

SELECT '✅ RESUMEN:' as status;
SELECT 
    COUNT(*) as total_modulos,
    COUNT(*) FILTER (WHERE is_base_module = true) as modulos_base,
    COUNT(*) FILTER (WHERE is_base_module = false) as modulos_adicionales,
    SUM(price_monthly) FILTER (WHERE is_base_module = false) as precio_total_mensual_adicionales
FROM platform_modules;
