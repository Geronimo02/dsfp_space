-- Create a limited view for POS operations that excludes PII
-- This allows all employees to access customer name and credit info without exposing email, phone, address
CREATE OR REPLACE VIEW customer_pos_view AS
SELECT 
  id,
  name,
  credit_limit,
  current_balance
FROM customers;

-- Grant SELECT access to all authenticated users
GRANT SELECT ON customer_pos_view TO authenticated;