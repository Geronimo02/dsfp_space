-- Function to handle stock reservation completion
CREATE OR REPLACE FUNCTION public.complete_stock_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When reservation is completed, deduct from physical stock
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    -- Deduct from product physical stock
    UPDATE products
    SET stock_physical = stock_physical - OLD.quantity,
        stock = stock_physical - stock_reserved - OLD.quantity
    WHERE id = OLD.product_id;
    
    -- If warehouse is specified, deduct from warehouse stock
    IF OLD.warehouse_id IS NOT NULL THEN
      UPDATE warehouse_stock
      SET stock_physical = stock_physical - OLD.quantity,
          stock = stock_physical - stock_reserved - OLD.quantity
      WHERE product_id = OLD.product_id
      AND warehouse_id = OLD.warehouse_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for stock reservation completion
DROP TRIGGER IF EXISTS trigger_complete_stock_reservation ON stock_reservations;
CREATE TRIGGER trigger_complete_stock_reservation
  BEFORE UPDATE ON stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION complete_stock_reservation();