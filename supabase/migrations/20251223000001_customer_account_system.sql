-- Tabla para movimientos de cuenta corriente del cliente
CREATE TABLE customer_account_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('sale', 'payment', 'credit_note', 'quotation', 'reservation', 'adjustment')),
    movement_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reference_number VARCHAR(100),
    description TEXT,
    debit_amount DECIMAL(12,2) DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount DECIMAL(12,2) DEFAULT 0 CHECK (credit_amount >= 0),
    balance DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'partial', 'cancelled')),
    due_date DATE,
    sale_id UUID REFERENCES sales(id),
    quotation_id UUID REFERENCES quotations(id),
    reservation_id UUID REFERENCES reservations(id),
    return_id UUID REFERENCES returns(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Restricción: solo uno de debit_amount o credit_amount puede ser > 0
    CONSTRAINT check_movement_amount CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    )
);

-- Tabla para aplicación de pagos a facturas específicas
CREATE TABLE invoice_payment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount_applied DECIMAL(12,2) NOT NULL CHECK (amount_applied > 0),
    applied_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Evitar aplicación duplicada del mismo pago a la misma factura
    UNIQUE(payment_id, sale_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_customer_account_movements_customer_id ON customer_account_movements(customer_id);
CREATE INDEX idx_customer_account_movements_date ON customer_account_movements(movement_date);
CREATE INDEX idx_customer_account_movements_type ON customer_account_movements(movement_type);
CREATE INDEX idx_customer_account_movements_status ON customer_account_movements(status);

CREATE INDEX idx_invoice_payment_applications_payment_id ON invoice_payment_applications(payment_id);
CREATE INDEX idx_invoice_payment_applications_sale_id ON invoice_payment_applications(sale_id);
CREATE INDEX idx_invoice_payment_applications_customer_id ON invoice_payment_applications(customer_id);

-- Función para actualizar el saldo del cliente automáticamente
CREATE OR REPLACE FUNCTION update_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular el saldo del cliente
    UPDATE customers 
    SET current_balance = (
        SELECT COALESCE(SUM(debit_amount - credit_amount), 0)
        FROM customer_account_movements 
        WHERE customer_id = NEW.customer_id
    )
    WHERE id = NEW.customer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar saldo cuando hay movimientos
CREATE TRIGGER trigger_update_customer_balance
    AFTER INSERT OR UPDATE OR DELETE ON customer_account_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_balance();

-- Función para crear movimiento automático cuando se crea una venta a crédito
CREATE OR REPLACE FUNCTION create_sale_account_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo crear movimiento si la venta es a crédito y tiene cliente
    IF NEW.payment_method = 'credit' AND NEW.customer_id IS NOT NULL THEN
        INSERT INTO customer_account_movements (
            customer_id,
            movement_type,
            reference_number,
            description,
            debit_amount,
            sale_id,
            user_id
        ) VALUES (
            NEW.customer_id,
            'sale',
            NEW.sale_number,
            'Venta a crédito',
            NEW.total,
            NEW.id,
            NEW.user_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para crear movimiento automático en ventas
CREATE TRIGGER trigger_create_sale_account_movement
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION create_sale_account_movement();

-- RLS (Row Level Security) policies
ALTER TABLE customer_account_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payment_applications ENABLE ROW LEVEL SECURITY;

-- Políticas para customer_account_movements
CREATE POLICY "Users can view customer movements" ON customer_account_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert customer movements" ON customer_account_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their customer movements" ON customer_account_movements FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para invoice_payment_applications
CREATE POLICY "Users can view payment applications" ON invoice_payment_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert payment applications" ON invoice_payment_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their payment applications" ON invoice_payment_applications FOR UPDATE USING (auth.uid() = user_id);
