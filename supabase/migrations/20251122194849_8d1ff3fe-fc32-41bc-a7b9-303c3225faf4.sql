-- Add reserved stock fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock_reserved integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS stock_physical integer;

-- Update stock_physical to equal current stock for existing products
UPDATE products 
SET stock_physical = stock 
WHERE stock_physical IS NULL;

-- Make stock_physical NOT NULL after updating
ALTER TABLE products 
ALTER COLUMN stock_physical SET NOT NULL,
ALTER COLUMN stock_physical SET DEFAULT 0;

-- Add reserved stock to warehouse_stock table
ALTER TABLE warehouse_stock
ADD COLUMN IF NOT EXISTS stock_reserved integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS stock_physical integer;

-- Update warehouse stock_physical to equal current stock
UPDATE warehouse_stock 
SET stock_physical = stock 
WHERE stock_physical IS NULL;

-- Make warehouse stock_physical NOT NULL after updating
ALTER TABLE warehouse_stock
ALTER COLUMN stock_physical SET NOT NULL,
ALTER COLUMN stock_physical SET DEFAULT 0;

-- Create stock reservations table
CREATE TABLE IF NOT EXISTS stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  reserved_by uuid NOT NULL,
  reserved_for text, -- customer name or reference
  reservation_type text NOT NULL DEFAULT 'manual', -- manual, sale, quotation, etc
  reference_id uuid, -- ID of sale, quotation, etc
  notes text,
  expires_at timestamp with time zone,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'expired', 'completed')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on stock_reservations
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_reservations
CREATE POLICY "Users can view stock reservations in their company"
ON stock_reservations FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

CREATE POLICY "Users can insert stock reservations in their company"
ON stock_reservations FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

CREATE POLICY "Users can update stock reservations in their company"
ON stock_reservations FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

CREATE POLICY "Users can delete stock reservations in their company"
ON stock_reservations FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_reservations_company_id ON stock_reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_id ON stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON stock_reservations(status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires_at ON stock_reservations(expires_at);

-- Create function to update stock_reserved based on active reservations
CREATE OR REPLACE FUNCTION update_product_reserved_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product reserved stock
  UPDATE products
  SET stock_reserved = COALESCE((
    SELECT SUM(quantity)
    FROM stock_reservations
    WHERE product_id = NEW.product_id
    AND status = 'active'
  ), 0)
  WHERE id = NEW.product_id;
  
  -- If warehouse_id is set, update warehouse reserved stock
  IF NEW.warehouse_id IS NOT NULL THEN
    UPDATE warehouse_stock
    SET stock_reserved = COALESCE((
      SELECT SUM(quantity)
      FROM stock_reservations
      WHERE product_id = NEW.product_id
      AND warehouse_id = NEW.warehouse_id
      AND status = 'active'
    ), 0)
    WHERE product_id = NEW.product_id
    AND warehouse_id = NEW.warehouse_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update reserved stock
CREATE TRIGGER trigger_update_reserved_stock
AFTER INSERT OR UPDATE OR DELETE ON stock_reservations
FOR EACH ROW
EXECUTE FUNCTION update_product_reserved_stock();

-- Create function to automatically expire old reservations
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS void AS $$
BEGIN
  UPDATE stock_reservations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the schema
COMMENT ON COLUMN products.stock_physical IS 'Stock físico real en el depósito';
COMMENT ON COLUMN products.stock_reserved IS 'Stock reservado (no disponible para venta)';
COMMENT ON COLUMN products.stock IS 'Stock disponible = stock_physical - stock_reserved';
COMMENT ON TABLE stock_reservations IS 'Reservas de stock por producto y depósito';