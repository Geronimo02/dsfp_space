-- Fix sale_items table to work with multi-company setup
-- Add company_id and RLS policies

-- Add company_id to sale_items (will be populated from sales table)
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Update existing sale_items to set company_id from their parent sale
UPDATE public.sale_items si
SET company_id = s.company_id
FROM public.sales s
WHERE si.sale_id = s.id
  AND si.company_id IS NULL;

-- Make company_id required going forward
ALTER TABLE public.sale_items 
ALTER COLUMN company_id SET NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sale_items_company ON public.sale_items(company_id);

-- Enable RLS on sale_items
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sale_items
DROP POLICY IF EXISTS "Users can view sale items from their company" ON public.sale_items;
DROP POLICY IF EXISTS "Users can insert sale items for their company" ON public.sale_items;
DROP POLICY IF EXISTS "Users can update sale items for their company" ON public.sale_items;
DROP POLICY IF EXISTS "Users can delete sale items for their company" ON public.sale_items;

CREATE POLICY "Users can view sale items from their company"
  ON public.sale_items FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can insert sale items for their company"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can update sale items for their company"
  ON public.sale_items FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can delete sale items for their company"
  ON public.sale_items FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Create trigger to auto-populate company_id from sales table
CREATE OR REPLACE FUNCTION public.set_sale_items_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If company_id is not set, get it from the sale
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM sales
    WHERE id = NEW.sale_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sale_items_company_id_trigger ON public.sale_items;
CREATE TRIGGER set_sale_items_company_id_trigger
  BEFORE INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_items_company_id();
