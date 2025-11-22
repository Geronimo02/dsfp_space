-- Create product_components table for mix/combo products
CREATE TABLE IF NOT EXISTS product_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  combo_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(combo_product_id, component_product_id)
);

-- Add is_combo field to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_combo boolean DEFAULT false NOT NULL;

-- Enable RLS
ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view product components in their company"
ON product_components FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

CREATE POLICY "Users can insert product components in their company"
ON product_components FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

CREATE POLICY "Users can update product components in their company"
ON product_components FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

CREATE POLICY "Users can delete product components in their company"
ON product_components FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_components_combo_id ON product_components(combo_product_id);
CREATE INDEX IF NOT EXISTS idx_product_components_component_id ON product_components(component_product_id);
CREATE INDEX IF NOT EXISTS idx_product_components_company_id ON product_components(company_id);

-- Function to calculate available stock for combo products
CREATE OR REPLACE FUNCTION get_combo_available_stock(p_combo_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  min_available integer;
BEGIN
  -- Calculate minimum available units based on components
  SELECT MIN(FLOOR((p.stock_physical - p.stock_reserved) / pc.quantity))
  INTO min_available
  FROM product_components pc
  INNER JOIN products p ON p.id = pc.component_product_id
  WHERE pc.combo_product_id = p_combo_product_id
  AND p.active = true;
  
  -- If no components, return 0
  RETURN COALESCE(min_available, 0);
END;
$$;

-- Function to deduct component stock when selling a combo
CREATE OR REPLACE FUNCTION deduct_combo_components_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  combo_rec RECORD;
  sale_status text;
BEGIN
  -- Only process if this is a new sale item and the sale is completed
  IF TG_OP = 'INSERT' THEN
    -- Get sale status
    SELECT status INTO sale_status
    FROM sales
    WHERE id = NEW.sale_id;
    
    -- Only deduct if sale is completed
    IF sale_status = 'completed' THEN
      -- Check if product is a combo
      SELECT is_combo INTO combo_rec
      FROM products
      WHERE id = NEW.product_id;
      
      IF combo_rec.is_combo THEN
        -- Deduct stock from all components
        UPDATE products p
        SET stock_physical = stock_physical - (pc.quantity * NEW.quantity),
            stock = stock_physical - stock_reserved - (pc.quantity * NEW.quantity)
        FROM product_components pc
        WHERE pc.combo_product_id = NEW.product_id
        AND p.id = pc.component_product_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to deduct component stock on sale
CREATE TRIGGER trigger_deduct_combo_components
AFTER INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION deduct_combo_components_stock();

-- Add trigger to update updated_at
CREATE TRIGGER update_product_components_updated_at
BEFORE UPDATE ON product_components
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE product_components IS 'Componentes de productos combo/mix';
COMMENT ON COLUMN products.is_combo IS 'Indica si el producto es un combo de otros productos';
COMMENT ON FUNCTION get_combo_available_stock IS 'Calcula stock disponible de combo basado en componentes';