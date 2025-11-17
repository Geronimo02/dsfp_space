-- Fix ALL functions that still reference the old company_settings table
-- These need to be updated to use the companies table instead

-- Fix update_loyalty_points_on_sale function (created in 20251022133249)
CREATE OR REPLACE FUNCTION public.update_loyalty_points_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_add INTEGER;
  points_per_currency NUMERIC;
  loyalty_active BOOLEAN;
  new_tier TEXT;
  new_total NUMERIC;
  company_rec RECORD;
BEGIN
  -- Solo procesar si la venta tiene cliente y está completada
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' AND NEW.company_id IS NOT NULL THEN
    -- Verificar si el programa de fidelización está activo para esta empresa
    SELECT loyalty_enabled, loyalty_points_per_currency,
           loyalty_gold_threshold, loyalty_silver_threshold
    INTO company_rec
    FROM companies
    WHERE id = NEW.company_id
    LIMIT 1;
    
    IF FOUND AND company_rec.loyalty_enabled THEN
      -- Calcular puntos a agregar
      points_to_add := FLOOR(NEW.total * company_rec.loyalty_points_per_currency);
      
      -- Actualizar puntos y total de compras del cliente
      UPDATE customers
      SET 
        loyalty_points = loyalty_points + points_to_add,
        total_purchases = total_purchases + NEW.total
      WHERE id = NEW.customer_id AND company_id = NEW.company_id
      RETURNING total_purchases INTO new_total;
      
      -- Determinar nuevo tier basado en total de compras
      SELECT CASE
        WHEN new_total >= company_rec.loyalty_gold_threshold THEN 'gold'
        WHEN new_total >= company_rec.loyalty_silver_threshold THEN 'silver'
        ELSE 'bronze'
      END INTO new_tier;
      
      -- Actualizar tier
      UPDATE customers
      SET loyalty_tier = new_tier
      WHERE id = NEW.customer_id AND company_id = NEW.company_id;
      
      -- Registrar transacción de puntos
      INSERT INTO loyalty_transactions (
        customer_id,
        points,
        type,
        reference_type,
        reference_id,
        description,
        user_id,
        company_id
      ) VALUES (
        NEW.customer_id,
        points_to_add,
        'earned',
        'sale',
        NEW.id,
        'Puntos ganados por compra #' || NEW.sale_number,
        NEW.user_id,
        NEW.company_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger for update_loyalty_points_on_sale
DROP TRIGGER IF EXISTS trigger_update_loyalty_points ON sales;
CREATE TRIGGER trigger_update_loyalty_points
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_points_on_sale();

-- Fix add_loyalty_points_on_sale function (if exists from other migrations)
CREATE OR REPLACE FUNCTION public.add_loyalty_points_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_add INTEGER;
  points_per_currency NUMERIC;
  loyalty_active BOOLEAN;
  new_tier TEXT;
  new_total NUMERIC;
  company_rec RECORD;
BEGIN
  -- Solo procesar si la venta tiene cliente y está completada
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' AND NEW.company_id IS NOT NULL THEN
    -- Verificar si el programa de fidelización está activo para esta empresa
    SELECT loyalty_enabled, loyalty_points_per_currency,
           loyalty_gold_threshold, loyalty_silver_threshold
    INTO company_rec
    FROM companies
    WHERE id = NEW.company_id
    LIMIT 1;
    
    IF FOUND AND company_rec.loyalty_enabled THEN
      -- Calcular puntos a agregar
      points_to_add := FLOOR(NEW.total * company_rec.loyalty_points_per_currency);
      
      -- Actualizar puntos y total de compras del cliente
      UPDATE customers
      SET 
        loyalty_points = loyalty_points + points_to_add,
        total_purchases = total_purchases + NEW.total
      WHERE id = NEW.customer_id AND company_id = NEW.company_id
      RETURNING total_purchases INTO new_total;
      
      -- Determinar nuevo tier basado en total de compras
      SELECT CASE
        WHEN new_total >= company_rec.loyalty_gold_threshold THEN 'gold'
        WHEN new_total >= company_rec.loyalty_silver_threshold THEN 'silver'
        ELSE 'bronze'
      END INTO new_tier;
      
      -- Actualizar tier
      UPDATE customers
      SET loyalty_tier = new_tier
      WHERE id = NEW.customer_id AND company_id = NEW.company_id;
      
      -- Registrar transacción de puntos
      INSERT INTO loyalty_transactions (
        customer_id,
        sale_id,
        points,
        transaction_type,
        description,
        company_id
      ) VALUES (
        NEW.customer_id,
        NEW.id,
        points_to_add,
        'earn',
        'Puntos ganados por compra',
        NEW.company_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger if needed
DROP TRIGGER IF EXISTS add_loyalty_points_trigger ON sales;
CREATE TRIGGER add_loyalty_points_trigger
  AFTER INSERT OR UPDATE OF status ON sales
  FOR EACH ROW
  EXECUTE FUNCTION add_loyalty_points_on_sale();
