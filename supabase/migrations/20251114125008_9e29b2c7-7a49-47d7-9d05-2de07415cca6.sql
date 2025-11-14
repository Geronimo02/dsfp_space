-- Fix orphaned products by assigning them to the most recent company
-- This will make old products visible again
UPDATE products 
SET company_id = (
  SELECT id FROM companies 
  WHERE active = true 
  ORDER BY created_at DESC 
  LIMIT 1
)
WHERE company_id IS NULL;

-- Delete duplicate companies, keeping only the most recent one per user
DELETE FROM company_users 
WHERE company_id IN (
  SELECT c.id 
  FROM companies c
  INNER JOIN company_users cu ON cu.company_id = c.id
  WHERE c.id NOT IN (
    SELECT DISTINCT ON (cu2.user_id) c2.id
    FROM companies c2
    INNER JOIN company_users cu2 ON cu2.company_id = c2.id
    ORDER BY cu2.user_id, c2.created_at DESC
  )
);

DELETE FROM companies 
WHERE id NOT IN (
  SELECT DISTINCT ON (cu.user_id) c.id
  FROM companies c
  INNER JOIN company_users cu ON cu.company_id = c.id
  ORDER BY cu.user_id, c.created_at DESC
);

-- Drop the legacy company_settings table as it's no longer used
-- All settings are now in the companies table
DROP TABLE IF EXISTS company_settings;

-- Add a check to prevent future issues with NULL company_id in products
ALTER TABLE products 
ALTER COLUMN company_id SET NOT NULL;

-- Add index to improve performance on company_id lookups
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);