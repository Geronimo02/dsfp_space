-- Fix RLS policies for company_subscriptions and calculate_subscription_price function

-- ========================================
-- 1. Fix calculate_subscription_price function to use SECURITY DEFINER
-- ========================================

DROP FUNCTION IF EXISTS calculate_subscription_price(UUID, VARCHAR, INTEGER);

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
) 
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
SET search_path = public
AS $$
DECLARE
    v_config RECORD;
    v_base DECIMAL := 0;
    v_modules DECIMAL := 0;
    v_volume DECIMAL := 0;
    v_total DECIMAL := 0;
    v_discount DECIMAL := 0;
BEGIN
    -- Verify user has access to this company
    IF NOT EXISTS (
        SELECT 1 FROM company_users 
        WHERE company_id = p_company_id 
        AND user_id = auth.uid()
        AND active = true
    ) AND NOT EXISTS (
        SELECT 1 FROM platform_admins
        WHERE user_id = auth.uid()
        AND active = true
    ) THEN
        RAISE EXCEPTION 'Access denied to company';
    END IF;

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
$$;

-- ========================================
-- 2. Add missing RLS policy for company users to manage their own company modules
-- ========================================

DROP POLICY IF EXISTS "Company admins can manage their company modules" ON company_modules;
CREATE POLICY "Company admins can manage their company modules"
    ON company_modules FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM company_users
            WHERE user_id = auth.uid() 
            AND role = 'admin'
            AND active = true
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_users
            WHERE user_id = auth.uid() 
            AND role = 'admin'
            AND active = true
        )
    );

-- ========================================
-- 3. Update company_subscriptions RLS to allow company users to update their subscription
-- ========================================

DROP POLICY IF EXISTS "Company admins can manage their subscription" ON company_subscriptions;
CREATE POLICY "Company admins can manage their subscription"
    ON company_subscriptions FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM company_users
            WHERE user_id = auth.uid() 
            AND role = 'admin'
            AND active = true
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_users
            WHERE user_id = auth.uid() 
            AND role = 'admin'
            AND active = true
        )
    );

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION calculate_subscription_price(UUID, VARCHAR, INTEGER) TO authenticated;

-- Comment
COMMENT ON FUNCTION calculate_subscription_price IS 'Calculates subscription price with SECURITY DEFINER to bypass RLS. Validates user access internally.';
