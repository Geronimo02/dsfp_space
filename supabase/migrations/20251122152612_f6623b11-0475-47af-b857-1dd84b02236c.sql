-- Crear tabla de configuración de comisiones
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC(12,2) NOT NULL CHECK (value >= 0),
  applies_to VARCHAR(20) NOT NULL CHECK (applies_to IN ('seller', 'customer', 'product', 'category')),
  reference_id UUID,
  active BOOLEAN DEFAULT true,
  min_amount NUMERIC(12,2),
  max_amount NUMERIC(12,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla de transacciones de comisiones
CREATE TABLE commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  commission_id UUID REFERENCES commissions(id) ON DELETE SET NULL,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  commission_type VARCHAR(20) NOT NULL,
  commission_value NUMERIC(12,2) NOT NULL,
  sale_amount NUMERIC(12,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_commissions_company ON commissions(company_id);
CREATE INDEX idx_commissions_applies_to ON commissions(applies_to, reference_id);
CREATE INDEX idx_commission_transactions_company ON commission_transactions(company_id);
CREATE INDEX idx_commission_transactions_user ON commission_transactions(user_id);
CREATE INDEX idx_commission_transactions_sale ON commission_transactions(sale_id);
CREATE INDEX idx_commission_transactions_status ON commission_transactions(status);
CREATE INDEX idx_commission_transactions_created ON commission_transactions(created_at);

-- Habilitar RLS
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para commissions
CREATE POLICY "Users can view commissions from their company"
  ON commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = commissions.company_id
        AND cu.user_id = auth.uid()
        AND cu.active = true
    )
  );

CREATE POLICY "Admins and managers can manage commissions"
  ON commissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = commissions.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('admin', 'manager')
        AND cu.active = true
    )
  );

-- Políticas para commission_transactions
CREATE POLICY "Users can view their own commission transactions"
  ON commission_transactions FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = commission_transactions.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('admin', 'manager')
        AND cu.active = true
    )
  );

CREATE POLICY "System can insert commission transactions"
  ON commission_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and managers can update commission transactions"
  ON commission_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = commission_transactions.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('admin', 'manager')
        AND cu.active = true
    )
  );

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_commissions_updated_at();

-- Función para calcular y crear comisiones en ventas
CREATE OR REPLACE FUNCTION calculate_sale_commissions()
RETURNS TRIGGER AS $$
DECLARE
  commission_rec RECORD;
  calculated_amount NUMERIC(12,2);
BEGIN
  -- Solo procesar si la venta está completada
  IF NEW.status = 'completed' AND NEW.company_id IS NOT NULL THEN
    
    -- Buscar comisiones activas para el vendedor (user_id)
    FOR commission_rec IN
      SELECT * FROM commissions
      WHERE company_id = NEW.company_id
        AND active = true
        AND applies_to = 'seller'
        AND reference_id = NEW.user_id
    LOOP
      -- Calcular monto de comisión
      IF commission_rec.type = 'percentage' THEN
        calculated_amount := NEW.total * (commission_rec.value / 100);
      ELSE
        calculated_amount := commission_rec.value;
      END IF;

      -- Validar límites si están configurados
      IF commission_rec.min_amount IS NOT NULL AND calculated_amount < commission_rec.min_amount THEN
        calculated_amount := commission_rec.min_amount;
      END IF;
      
      IF commission_rec.max_amount IS NOT NULL AND calculated_amount > commission_rec.max_amount THEN
        calculated_amount := commission_rec.max_amount;
      END IF;

      -- Insertar transacción de comisión
      INSERT INTO commission_transactions (
        company_id,
        commission_id,
        sale_id,
        user_id,
        customer_id,
        commission_type,
        commission_value,
        sale_amount,
        commission_amount,
        status
      ) VALUES (
        NEW.company_id,
        commission_rec.id,
        NEW.id,
        NEW.user_id,
        NEW.customer_id,
        commission_rec.type,
        commission_rec.value,
        NEW.total,
        calculated_amount,
        'pending'
      );
    END LOOP;

    -- Buscar comisiones por cliente
    IF NEW.customer_id IS NOT NULL THEN
      FOR commission_rec IN
        SELECT * FROM commissions
        WHERE company_id = NEW.company_id
          AND active = true
          AND applies_to = 'customer'
          AND reference_id = NEW.customer_id
      LOOP
        -- Calcular monto de comisión
        IF commission_rec.type = 'percentage' THEN
          calculated_amount := NEW.total * (commission_rec.value / 100);
        ELSE
          calculated_amount := commission_rec.value;
        END IF;

        -- Validar límites
        IF commission_rec.min_amount IS NOT NULL AND calculated_amount < commission_rec.min_amount THEN
          calculated_amount := commission_rec.min_amount;
        END IF;
        
        IF commission_rec.max_amount IS NOT NULL AND calculated_amount > commission_rec.max_amount THEN
          calculated_amount := commission_rec.max_amount;
        END IF;

        -- Insertar transacción
        INSERT INTO commission_transactions (
          company_id,
          commission_id,
          sale_id,
          user_id,
          customer_id,
          commission_type,
          commission_value,
          sale_amount,
          commission_amount,
          status
        ) VALUES (
          NEW.company_id,
          commission_rec.id,
          NEW.id,
          NEW.user_id,
          NEW.customer_id,
          commission_rec.type,
          commission_rec.value,
          NEW.total,
          calculated_amount,
          'pending'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para calcular comisiones en ventas
CREATE TRIGGER calculate_sale_commissions_trigger
  AFTER INSERT OR UPDATE OF status ON sales
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_commissions();