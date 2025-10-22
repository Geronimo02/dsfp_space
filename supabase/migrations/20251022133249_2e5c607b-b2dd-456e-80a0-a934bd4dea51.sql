-- Programa de Fidelización
-- Agregar campos de fidelización a clientes
ALTER TABLE customers
ADD COLUMN loyalty_points INTEGER DEFAULT 0,
ADD COLUMN loyalty_tier TEXT DEFAULT 'bronze',
ADD COLUMN total_purchases NUMERIC DEFAULT 0;

-- Crear tabla para transacciones de puntos de fidelización
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'earned', 'redeemed', 'expired', 'adjusted'
  reference_type TEXT, -- 'sale', 'manual', 'promotion'
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Agregar configuración de fidelización en company_settings
ALTER TABLE company_settings
ADD COLUMN loyalty_enabled BOOLEAN DEFAULT false,
ADD COLUMN loyalty_points_per_currency NUMERIC DEFAULT 1, -- Cuántos puntos por cada unidad de moneda gastada
ADD COLUMN loyalty_currency_per_point NUMERIC DEFAULT 0.01, -- Valor de cada punto en moneda
ADD COLUMN loyalty_bronze_threshold NUMERIC DEFAULT 0,
ADD COLUMN loyalty_silver_threshold NUMERIC DEFAULT 10000,
ADD COLUMN loyalty_gold_threshold NUMERIC DEFAULT 50000,
ADD COLUMN loyalty_bronze_discount NUMERIC DEFAULT 0,
ADD COLUMN loyalty_silver_discount NUMERIC DEFAULT 5,
ADD COLUMN loyalty_gold_discount NUMERIC DEFAULT 10;

-- Múltiples Métodos de Pago por Venta
CREATE TABLE sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL, -- 'cash', 'card', 'transfer', 'credit'
  amount NUMERIC NOT NULL CHECK (amount > 0),
  card_surcharge NUMERIC DEFAULT 0,
  installments INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sistema de Reservas/Layaway
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'expired'
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC NOT NULL,
  expiration_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  converted_to_sale_id UUID REFERENCES sales(id)
);

CREATE TABLE reservation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE reservation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para mejor rendimiento
CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_transactions_created ON loyalty_transactions(created_at DESC);
CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX idx_reservations_customer ON reservations(customer_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservation_items_reservation ON reservation_items(reservation_id);
CREATE INDEX idx_reservation_payments_reservation ON reservation_payments(reservation_id);

-- Función para generar número de reserva
CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM reservations;
  new_number := 'RES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Función para actualizar puntos de fidelización después de una venta
CREATE OR REPLACE FUNCTION update_loyalty_points_on_sale()
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
BEGIN
  -- Solo procesar si la venta tiene cliente y está completada
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' THEN
    -- Verificar si el programa de fidelización está activo
    SELECT loyalty_enabled, loyalty_points_per_currency 
    INTO loyalty_active, points_per_currency
    FROM company_settings
    LIMIT 1;
    
    IF loyalty_active THEN
      -- Calcular puntos a agregar
      points_to_add := FLOOR(NEW.total * points_per_currency);
      
      -- Actualizar puntos y total de compras del cliente
      UPDATE customers
      SET 
        loyalty_points = loyalty_points + points_to_add,
        total_purchases = total_purchases + NEW.total
      WHERE id = NEW.customer_id
      RETURNING total_purchases INTO new_total;
      
      -- Determinar nuevo tier basado en total de compras
      SELECT CASE
        WHEN new_total >= (SELECT loyalty_gold_threshold FROM company_settings LIMIT 1) THEN 'gold'
        WHEN new_total >= (SELECT loyalty_silver_threshold FROM company_settings LIMIT 1) THEN 'silver'
        ELSE 'bronze'
      END INTO new_tier;
      
      -- Actualizar tier
      UPDATE customers
      SET loyalty_tier = new_tier
      WHERE id = NEW.customer_id;
      
      -- Registrar transacción de puntos
      INSERT INTO loyalty_transactions (
        customer_id,
        points,
        type,
        reference_type,
        reference_id,
        description,
        user_id
      ) VALUES (
        NEW.customer_id,
        points_to_add,
        'earned',
        'sale',
        NEW.id,
        'Puntos ganados por compra #' || NEW.sale_number,
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para actualizar puntos después de venta
CREATE TRIGGER trigger_update_loyalty_points
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION update_loyalty_points_on_sale();

-- Función para actualizar monto pagado de reserva
CREATE OR REPLACE FUNCTION update_reservation_paid_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE reservations
  SET 
    paid_amount = paid_amount + NEW.amount,
    remaining_amount = total - (paid_amount + NEW.amount),
    updated_at = now()
  WHERE id = NEW.reservation_id;
  
  RETURN NEW;
END;
$$;

-- Trigger para actualizar monto pagado
CREATE TRIGGER trigger_update_reservation_paid
AFTER INSERT ON reservation_payments
FOR EACH ROW
EXECUTE FUNCTION update_reservation_paid_amount();

-- Trigger para updated_at en reservas
CREATE TRIGGER update_reservations_updated_at
BEFORE UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies para loyalty_transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view loyalty transactions"
ON loyalty_transactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can insert loyalty transactions"
ON loyalty_transactions FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies para sale_payments
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view sale payments"
ON sale_payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone authenticated can insert sale payments"
ON sale_payments FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies para reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reservations"
ON reservations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone authenticated can insert reservations"
ON reservations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can update reservations"
ON reservations FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Only admins can delete reservations"
ON reservations FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies para reservation_items
ALTER TABLE reservation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reservation items"
ON reservation_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone authenticated can insert reservation items"
ON reservation_items FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies para reservation_payments
ALTER TABLE reservation_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reservation payments"
ON reservation_payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone authenticated can insert reservation payments"
ON reservation_payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);