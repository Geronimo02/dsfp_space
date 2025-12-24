-- Migration: Sistema de Precios Modular
-- Creación de tablas para configuración de precios, módulos y asignación por empresa

-- ========================================
-- 1. Tabla de Configuración Global de Precios
-- ========================================
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

-- Insertar configuración inicial
INSERT INTO platform_pricing_config (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 2. Tabla de Módulos Disponibles
-- ========================================
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

-- Insertar módulos iniciales basados en el sidebar completo
INSERT INTO platform_modules (code, name, description, price_monthly, price_annual, is_base_module, display_order) VALUES
    -- ==================== MÓDULOS BASE (incluidos en el paquete) ====================
    ('dashboard', 'Dashboard', 'Panel principal con métricas y estadísticas', 0, 0, TRUE, 1),
    ('pos', 'Punto de Venta', 'Sistema de punto de venta integrado', 0, 0, TRUE, 2),
    ('products', 'Productos', 'Gestión de catálogo de productos', 0, 0, TRUE, 3),
    ('sales', 'Ventas', 'Gestión de ventas y facturación', 0, 0, TRUE, 4),
    ('customers', 'Clientes', 'Administración de clientes', 0, 0, TRUE, 5),
    
    -- ==================== VENTAS & CLIENTES ====================
    ('quotations', 'Presupuestos', 'Creación y gestión de presupuestos', 2000, 20400, FALSE, 10),
    ('delivery_notes', 'Remitos', 'Gestión de remitos de entrega', 2000, 20400, FALSE, 11),
    ('returns', 'Devoluciones', 'Gestión de devoluciones de productos', 2000, 20400, FALSE, 12),
    ('reservations', 'Reservas', 'Sistema de reservas de productos/servicios', 2500, 25500, FALSE, 13),
    ('accounts_receivable', 'Cuentas Corrientes', 'Gestión de cuentas corrientes de clientes', 3000, 30600, FALSE, 14),
    
    -- ==================== INVENTARIO & COMPRAS ====================
    ('inventory_alerts', 'Alertas de Inventario', 'Notificaciones automáticas de stock bajo', 1500, 15300, FALSE, 20),
    ('warehouses', 'Depósitos', 'Gestión de múltiples depósitos', 3500, 35700, FALSE, 21),
    ('warehouse_stock', 'Stock por Depósito', 'Control de stock por ubicación', 3000, 30600, FALSE, 22),
    ('warehouse_transfers', 'Transferencias', 'Transferencias entre depósitos', 2500, 25500, FALSE, 23),
    ('stock_reservations', 'Reservas de Stock', 'Reservas de stock para pedidos', 2000, 20400, FALSE, 24),
    ('purchases', 'Compras', 'Gestión de órdenes de compra', 3000, 30600, FALSE, 25),
    ('suppliers', 'Proveedores', 'Administración de proveedores', 2000, 20400, FALSE, 26),
    
    -- ==================== GESTIÓN ====================
    ('technical_services', 'Servicios Técnicos', 'Gestión de servicios técnicos y reparaciones', 4000, 40800, FALSE, 30),
    ('promotions', 'Promociones', 'Creación y gestión de promociones', 2500, 25500, FALSE, 31),
    ('cash_register', 'Gestión de Caja', 'Control de caja y movimientos diarios', 2500, 25500, FALSE, 32),
    ('checks', 'Cheques', 'Control y gestión de cheques', 2000, 20400, FALSE, 33),
    ('expenses', 'Gastos', 'Control de gastos operativos', 2500, 25500, FALSE, 34),
    ('commissions', 'Comisiones', 'Cálculo y gestión de comisiones', 3000, 30600, FALSE, 35),
    ('employees', 'Usuarios', 'Administración de usuarios y permisos', 3000, 30600, FALSE, 36),
    
    -- ==================== TESORERÍA ====================
    ('bank_accounts', 'Cuentas Bancarias', 'Gestión de cuentas bancarias', 3000, 30600, FALSE, 40),
    ('bank_movements', 'Movimientos Bancarios', 'Control de movimientos bancarios', 3000, 30600, FALSE, 41),
    ('card_movements', 'Movimientos de Tarjetas', 'Control de movimientos con tarjetas', 3000, 30600, FALSE, 42),
    ('retentions', 'Retenciones', 'Gestión de retenciones fiscales', 2500, 25500, FALSE, 43),
    
    -- ==================== INTEGRACIONES ====================
    ('integrations', 'Integraciones', 'Integraciones con sistemas externos', 5000, 51000, FALSE, 50),
    
    -- ==================== RRHH ====================
    ('payroll', 'Liquidaciones', 'Gestión de liquidaciones de sueldos', 5000, 51000, FALSE, 60),
    
    -- ==================== REPORTES & ADMIN ====================
    ('reports', 'Reportes', 'Reportes avanzados y análisis', 4000, 40800, FALSE, 70),
    ('monthly_closing', 'Cierre Mensual', 'Cierre contable mensual', 3500, 35700, FALSE, 71),
    ('accountant_reports', 'Reportes Contador', 'Reportes específicos para contadores', 4000, 40800, FALSE, 72),
    ('ai_assistant', 'Asistente IA', 'Asistente inteligente con IA', 6000, 61200, FALSE, 73),
    ('audit_logs', 'Auditoría', 'Registro de auditoría de acciones', 2500, 25500, FALSE, 74),
    ('access_logs', 'Logs de Acceso', 'Registro de accesos al sistema', 2000, 20400, FALSE, 75),
    ('bulk_operations', 'Operaciones Masivas', 'Operaciones en lote', 3000, 30600, FALSE, 76),
    ('afip_pos_points', 'Puntos de Venta AFIP', 'Gestión de puntos de venta AFIP', 8000, 81600, FALSE, 77),
    ('notifications', 'Notificaciones', 'Sistema de notificaciones personalizadas', 2000, 20400, FALSE, 78),
    ('settings', 'Configuración', 'Configuración avanzada del sistema', 0, 0, TRUE, 79)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 3. Tabla de Módulos por Empresa
-- ========================================
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

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_company_modules_company ON company_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_module ON company_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_active ON company_modules(active);

-- ========================================
-- 4. Actualizar tabla company_subscriptions
-- ========================================
ALTER TABLE company_subscriptions 
ADD COLUMN IF NOT EXISTS monthly_invoice_volume INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS modules_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS volume_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pricing_details JSONB DEFAULT '{}'::jsonb;

-- ========================================
-- 5. Función para activar módulos base automáticamente
-- ========================================
CREATE OR REPLACE FUNCTION activate_base_modules_for_company()
RETURNS TRIGGER AS $$
BEGIN
    -- Insertar todos los módulos base para la nueva empresa
    INSERT INTO company_modules (company_id, module_id, active)
    SELECT NEW.id, id, TRUE
    FROM platform_modules
    WHERE is_base_module = TRUE
    ON CONFLICT (company_id, module_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para activar módulos base automáticamente al crear empresa
DROP TRIGGER IF EXISTS trigger_activate_base_modules ON companies;
CREATE TRIGGER trigger_activate_base_modules
    AFTER INSERT ON companies
    FOR EACH ROW
    EXECUTE FUNCTION activate_base_modules_for_company();

-- ========================================
-- 6. Función para calcular precio de suscripción
-- ========================================
-- Eliminar todas las versiones posibles de la función
DO $$ 
BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS calculate_subscription_price CASCADE';
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION calculate_subscription_price(
    p_company_id UUID,
    p_billing_cycle VARCHAR DEFAULT 'monthly',
    p_invoice_volume INTEGER DEFAULT 0
)
RETURNS TABLE(
    total_price DECIMAL,
    base_price DECIMAL,
    modules_price DECIMAL,
    volume_price DECIMAL,
    breakdown JSONB
) AS $$
DECLARE
    v_config RECORD;
    v_base DECIMAL := 0;
    v_modules DECIMAL := 0;
    v_volume DECIMAL := 0;
    v_total DECIMAL := 0;
    v_discount DECIMAL := 0;
BEGIN
    -- Obtener configuración de precios
    SELECT * INTO v_config FROM platform_pricing_config LIMIT 1;
    
    -- Calcular precio base
    IF p_billing_cycle = 'annual' THEN
        v_base := v_config.base_package_price_annual;
    ELSE
        v_base := v_config.base_package_price_monthly;
    END IF;
    
    -- Calcular precio de módulos adicionales
    SELECT COALESCE(SUM(
        CASE 
            WHEN p_billing_cycle = 'annual' THEN pm.price_annual
            ELSE pm.price_monthly
        END
    ), 0) INTO v_modules
    FROM company_modules cm
    JOIN platform_modules pm ON cm.module_id = pm.id
    WHERE cm.company_id = p_company_id 
        AND cm.active = TRUE 
        AND pm.is_base_module = FALSE;
    
    -- Calcular precio por volumen de facturas
    SELECT COALESCE(
        (tier->>'price')::DECIMAL, 0
    ) INTO v_volume
    FROM platform_pricing_config,
         jsonb_array_elements(invoice_volume_tiers) AS tier
    WHERE (tier->>'min')::INTEGER <= p_invoice_volume
        AND ((tier->>'max') IS NULL OR (tier->>'max')::INTEGER >= p_invoice_volume)
    LIMIT 1;
    
    -- Calcular total
    v_total := v_base + v_modules + v_volume;
    
    RETURN QUERY SELECT 
        v_total,
        v_base,
        v_modules,
        v_volume,
        jsonb_build_object(
            'base_price', v_base,
            'modules_price', v_modules,
            'volume_price', v_volume,
            'total_price', v_total,
            'billing_cycle', p_billing_cycle,
            'invoice_volume', p_invoice_volume
        );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. RLS Policies
-- ========================================

-- platform_pricing_config: Solo admin puede ver y editar
ALTER TABLE platform_pricing_config ENABLE ROW LEVEL SECURITY;

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

-- platform_modules: Admin puede todo, usuarios pueden ver módulos activos
ALTER TABLE platform_modules ENABLE ROW LEVEL SECURITY;

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

-- company_modules: Admin puede todo, usuarios solo ven los de su empresa
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;

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

-- ========================================
-- 8. Comentarios
-- ========================================
COMMENT ON TABLE platform_pricing_config IS 'Configuración global del sistema de precios modular';
COMMENT ON TABLE platform_modules IS 'Catálogo de módulos disponibles con precios';
COMMENT ON TABLE company_modules IS 'Módulos activos por empresa';
