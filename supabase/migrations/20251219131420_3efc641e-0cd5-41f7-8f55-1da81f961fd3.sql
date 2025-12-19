-- Activate customer_support module for the company
INSERT INTO company_modules (company_id, module_id, active, status)
VALUES (
  'b30c8906-46f3-4b95-bf38-c6286e2ed1f5',
  'cc2552ae-7f89-4533-896a-80acfbcd1611',
  true,
  'active'
)
ON CONFLICT (company_id, module_id) DO UPDATE SET active = true, status = 'active';