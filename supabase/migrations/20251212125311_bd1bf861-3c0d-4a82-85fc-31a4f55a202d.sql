
-- Fix calculate_subscription_price to avoid set-returning functions
CREATE OR REPLACE FUNCTION public.calculate_subscription_price(
  p_company_id UUID,
  p_billing_cycle TEXT DEFAULT 'monthly',
  p_invoice_volume INTEGER DEFAULT 0
)
RETURNS TABLE(
  total_price DECIMAL(10,2),
  base_price DECIMAL(10,2),
  modules_price DECIMAL(10,2),
  volume_price DECIMAL(10,2),
  breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_price DECIMAL(10,2) := 0;
  v_modules_price DECIMAL(10,2) := 0;
  v_volume_price DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2);
  v_breakdown JSONB;
  v_config RECORD;
  v_tier JSONB;
  v_tiers JSONB;
  v_tier_min INTEGER;
  v_tier_max INTEGER;
  v_tier_price DECIMAL(10,2);
  i INTEGER;
BEGIN
  -- Get pricing config
  SELECT * INTO v_config 
  FROM platform_pricing_config 
  WHERE is_active = true 
  LIMIT 1;
  
  -- Set base price based on billing cycle
  IF p_billing_cycle = 'annual' THEN
    v_base_price := COALESCE(v_config.base_package_price_annual, 0);
  ELSE
    v_base_price := COALESCE(v_config.base_package_price_monthly, 0);
  END IF;

  -- Calculate modules price from active company modules (excluding base modules)
  SELECT COALESCE(SUM(
    CASE 
      WHEN p_billing_cycle = 'annual' THEN pm.price_annual
      ELSE pm.price_monthly
    END
  ), 0)
  INTO v_modules_price
  FROM company_modules cm
  INNER JOIN platform_modules pm ON pm.id = cm.module_id
  WHERE cm.company_id = p_company_id
    AND cm.active = true
    AND pm.is_base_module = false
    AND pm.is_active = true;

  -- Calculate volume price based on invoice volume tiers using array indexing
  v_tiers := v_config.invoice_volume_tiers;
  IF v_tiers IS NOT NULL AND jsonb_typeof(v_tiers) = 'array' AND jsonb_array_length(v_tiers) > 0 THEN
    FOR i IN 0..jsonb_array_length(v_tiers) - 1
    LOOP
      v_tier := v_tiers->i;
      v_tier_min := COALESCE((v_tier->>'min')::INTEGER, 0);
      v_tier_price := COALESCE((v_tier->>'price')::DECIMAL, 0);
      
      -- Handle max value (can be null for unlimited)
      IF v_tier->>'max' IS NULL OR v_tier->>'max' = 'null' THEN
        v_tier_max := 2147483647; -- Max integer value
      ELSE
        v_tier_max := (v_tier->>'max')::INTEGER;
      END IF;
      
      -- Check if invoice volume falls in this tier
      IF p_invoice_volume >= v_tier_min AND p_invoice_volume <= v_tier_max THEN
        v_volume_price := v_tier_price;
        EXIT; -- Found the tier, exit loop
      END IF;
    END LOOP;
  END IF;

  -- Calculate total
  v_total := v_base_price + v_modules_price + COALESCE(v_volume_price, 0);

  -- Build breakdown JSON
  v_breakdown := jsonb_build_object(
    'base_price', v_base_price,
    'modules_price', v_modules_price,
    'volume_price', COALESCE(v_volume_price, 0),
    'total_price', v_total,
    'billing_cycle', p_billing_cycle,
    'invoice_volume', p_invoice_volume
  );

  RETURN QUERY SELECT v_total, v_base_price, v_modules_price, COALESCE(v_volume_price, 0), v_breakdown;
END;
$$;
