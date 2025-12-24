-- Migration: Custom Pricing Per Company
-- Date: 2025-12-04
-- Purpose: Allow custom pricing for specific companies/modules

-- =====================================================
-- 1. TABLA DE PRECIOS PERSONALIZADOS
-- =====================================================

CREATE TABLE IF NOT EXISTS company_custom_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id UUID REFERENCES platform_modules(id) ON DELETE CASCADE,
  
  -- Precios personalizados (NULL significa usar precio estándar)
  custom_price_monthly DECIMAL(10,2),
  custom_price_annual DECIMAL(10,2),
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Razón del precio especial
  reason TEXT,
  notes TEXT,
  
  -- Vigencia
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Metadata
  applied_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un precio personalizado por empresa-módulo
  UNIQUE(company_id, module_id),
  
  -- Validaciones
  CONSTRAINT valid_prices CHECK (
    custom_price_monthly IS NULL OR custom_price_monthly >= 0
  ),
  CONSTRAINT valid_annual CHECK (
    custom_price_annual IS NULL OR custom_price_annual >= 0
  ),
  CONSTRAINT valid_discount CHECK (
    discount_percentage >= 0 AND discount_percentage <= 100
  )
);

-- Índices para performance
CREATE INDEX idx_company_custom_pricing_company ON company_custom_pricing(company_id);
CREATE INDEX idx_company_custom_pricing_module ON company_custom_pricing(module_id);
CREATE INDEX idx_company_custom_pricing_valid ON company_custom_pricing(valid_from, valid_until);

-- =====================================================
-- 2. FUNCIÓN PARA OBTENER PRECIO EFECTIVO
-- =====================================================

CREATE OR REPLACE FUNCTION get_effective_module_price(
  p_company_id UUID,
  p_module_id UUID,
  p_billing_cycle TEXT DEFAULT 'monthly'
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_custom_price DECIMAL(10,2);
  v_standard_price DECIMAL(10,2);
  v_discount DECIMAL(5,2);
  v_final_price DECIMAL(10,2);
BEGIN
  -- Obtener precio estándar del módulo
  IF p_billing_cycle = 'annual' THEN
    SELECT price_annual INTO v_standard_price
    FROM platform_modules
    WHERE id = p_module_id;
  ELSE
    SELECT price_monthly INTO v_standard_price
    FROM platform_modules
    WHERE id = p_module_id;
  END IF;

  -- Buscar precio personalizado vigente
  SELECT 
    CASE 
      WHEN p_billing_cycle = 'annual' THEN custom_price_annual
      ELSE custom_price_monthly
    END,
    discount_percentage
  INTO v_custom_price, v_discount
  FROM company_custom_pricing
  WHERE company_id = p_company_id
    AND module_id = p_module_id
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW());

  -- Calcular precio final
  IF v_custom_price IS NOT NULL THEN
    -- Usar precio personalizado
    v_final_price := v_custom_price;
  ELSE
    -- Usar precio estándar
    v_final_price := v_standard_price;
  END IF;

  -- Aplicar descuento si existe
  IF v_discount IS NOT NULL AND v_discount > 0 THEN
    v_final_price := v_final_price * (1 - v_discount / 100);
  END IF;

  RETURN COALESCE(v_final_price, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- 3. FUNCIÓN PARA CALCULAR PRECIO TOTAL DE SUSCRIPCIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_company_subscription_price(
  p_company_id UUID,
  p_billing_cycle TEXT DEFAULT 'monthly',
  p_invoice_volume INTEGER DEFAULT 0
)
RETURNS TABLE(
  base_price DECIMAL(10,2),
  modules_price DECIMAL(10,2),
  volume_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  breakdown JSONB
) AS $$
DECLARE
  v_base_price DECIMAL(10,2);
  v_modules_price DECIMAL(10,2) := 0;
  v_volume_price DECIMAL(10,2) := 0;
  v_module_breakdown JSONB := '[]'::jsonb;
  v_module RECORD;
BEGIN
  -- Obtener precio base del paquete
  IF p_billing_cycle = 'annual' THEN
    SELECT base_package_price_annual INTO v_base_price
    FROM platform_pricing_config
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT base_package_price_monthly INTO v_base_price
    FROM platform_pricing_config
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Calcular precio de módulos adicionales activos
  FOR v_module IN
    SELECT 
      pm.id,
      pm.name,
      pm.code,
      cm.active
    FROM company_modules cm
    JOIN platform_modules pm ON pm.id = cm.module_id
    WHERE cm.company_id = p_company_id
      AND cm.active = true
      AND pm.is_base_module = false
  LOOP
    DECLARE
      v_module_price DECIMAL(10,2);
    BEGIN
      v_module_price := get_effective_module_price(
        p_company_id,
        v_module.id,
        p_billing_cycle
      );
      
      v_modules_price := v_modules_price + v_module_price;
      
      v_module_breakdown := v_module_breakdown || jsonb_build_object(
        'module_id', v_module.id,
        'module_name', v_module.name,
        'module_code', v_module.code,
        'price', v_module_price
      );
    END;
  END LOOP;

  -- Calcular precio por volumen de facturas
  SELECT 
    CASE 
      WHEN p_invoice_volume >= tier.min AND 
           (tier.max IS NULL OR p_invoice_volume <= tier.max)
      THEN tier.price
      ELSE 0
    END INTO v_volume_price
  FROM platform_pricing_config pc,
       jsonb_to_recordset(pc.invoice_volume_tiers) AS tier(
         min INT,
         max INT,
         price DECIMAL(10,2)
       )
  WHERE p_invoice_volume >= tier.min 
    AND (tier.max IS NULL OR p_invoice_volume <= tier.max)
  ORDER BY pc.created_at DESC
  LIMIT 1;

  v_volume_price := COALESCE(v_volume_price, 0);

  -- Retornar resultado
  RETURN QUERY SELECT
    v_base_price,
    v_modules_price,
    v_volume_price,
    v_base_price + v_modules_price + v_volume_price AS total,
    jsonb_build_object(
      'base_price', v_base_price,
      'modules_price', v_modules_price,
      'volume_price', v_volume_price,
      'modules', v_module_breakdown,
      'billing_cycle', p_billing_cycle,
      'invoice_volume', p_invoice_volume
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- 4. TRIGGER PARA ACTUALIZAR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_company_custom_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_custom_pricing_updated_at
  BEFORE UPDATE ON company_custom_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_company_custom_pricing_updated_at();

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE company_custom_pricing ENABLE ROW LEVEL SECURITY;

-- Platform admins pueden gestionar todos los precios personalizados
CREATE POLICY "Platform admins manage custom pricing"
  ON company_custom_pricing FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Usuarios pueden ver los precios de su empresa
CREATE POLICY "Users view their company pricing"
  ON company_custom_pricing FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid() 
      AND active = true
    )
  );

-- =====================================================
-- 6. COMENTARIOS
-- =====================================================

COMMENT ON TABLE company_custom_pricing IS 
'Precios personalizados por empresa y módulo';

COMMENT ON FUNCTION get_effective_module_price(UUID, UUID, TEXT) IS 
'Obtiene el precio efectivo de un módulo considerando precios personalizados y descuentos';

COMMENT ON FUNCTION calculate_company_subscription_price(UUID, TEXT, INTEGER) IS 
'Calcula el precio total de suscripción de una empresa incluyendo base, módulos y volumen';
