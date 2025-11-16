-- Migration: Update customer_pos_view to include price_list_id
-- Description: Adds price_list_id to customer_pos_view for automatic price selection in POS
-- Created: 2025-11-14

DROP VIEW IF EXISTS customer_pos_view;

CREATE VIEW customer_pos_view
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  credit_limit,
  current_balance,
  price_list_id,
  loyalty_points,
  loyalty_tier,
  condicion_iva
FROM customers;

-- Grant SELECT access to all authenticated users
GRANT SELECT ON customer_pos_view TO authenticated;

COMMENT ON VIEW customer_pos_view IS 'Customer view for POS with price list assignment and loyalty information';
