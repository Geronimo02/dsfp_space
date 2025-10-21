-- Drop and recreate the view with SECURITY INVOKER to use the querying user's permissions
DROP VIEW IF EXISTS customer_pos_view;

CREATE VIEW customer_pos_view
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  credit_limit,
  current_balance
FROM customers;

-- Grant SELECT access to all authenticated users
GRANT SELECT ON customer_pos_view TO authenticated;