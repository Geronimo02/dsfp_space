-- Fix the calculate_subscription_price function to properly calculate prices
CREATE OR REPLACE FUNCTION public.calculate_subscription_price(
  p_company_id uuid, 
  p_billing_cycle text DEFAULT 'monthly'::text, 
  p_invoice_volume integer DEFAULT 0
)
RETURNS TABLE(total_price numeric, base_price numeric, modules_price numeric, volume_price numeric, breakdown jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_price DECIMAL(10,2) := 0;
  v_modules_price DECIMAL(10,2) := 0;
  v_volume_price DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2);
  v_breakdown JSONB;
  v_config RECORD;
  v_tier RECORD;
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

  -- Calculate volume price based on invoice volume tiers
  IF v_config.invoice_volume_tiers IS NOT NULL THEN
    SELECT COALESCE((tier->>'price')::DECIMAL, 0) INTO v_volume_price
    FROM jsonb_array_elements(v_config.invoice_volume_tiers) AS tier
    WHERE p_invoice_volume >= (tier->>'min')::INTEGER
      AND (
        (tier->>'max')::TEXT IS NULL 
        OR (tier->>'max')::TEXT = 'null' 
        OR p_invoice_volume <= (tier->>'max')::INTEGER
      )
    LIMIT 1;
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
$function$;