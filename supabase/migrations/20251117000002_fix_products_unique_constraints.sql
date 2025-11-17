-- Fix products table constraints to be unique per company
-- This allows different companies to use the same barcode/SKU

-- Drop existing UNIQUE constraints on barcode and sku
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_barcode_key;

ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_sku_key;

-- Add new UNIQUE constraints that include company_id
-- This makes barcode and sku unique per company instead of globally unique
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_company_key 
ON public.products (barcode, company_id) 
WHERE barcode IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_company_key 
ON public.products (sku, company_id) 
WHERE sku IS NOT NULL;

-- Note: We use partial indexes with WHERE clauses to allow NULL values
-- This is important because NULL != NULL in SQL, so multiple NULLs should be allowed
