-- Función para obtener movimientos del cliente
CREATE OR REPLACE FUNCTION get_customer_movements(customer_id UUID)
RETURNS TABLE (
    id UUID,
    movement_date TIMESTAMP WITH TIME ZONE,
    movement_type VARCHAR(50),
    reference_number VARCHAR(100),
    description TEXT,
    debit_amount DECIMAL(12,2),
    credit_amount DECIMAL(12,2),
    balance DECIMAL(12,2),
    status VARCHAR(20)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cam.id,
        cam.movement_date,
        cam.movement_type,
        cam.reference_number,
        cam.description,
        cam.debit_amount,
        cam.credit_amount,
        cam.balance,
        cam.status
    FROM customer_account_movements cam
    WHERE cam.customer_id = get_customer_movements.customer_id
    ORDER BY cam.movement_date DESC;
END;
$$;

-- Función para obtener pagos aplicados a facturas
CREATE OR REPLACE FUNCTION get_invoice_payments(customer_id UUID)
RETURNS TABLE (
    id UUID,
    sale_id UUID,
    amount_applied DECIMAL(12,2),
    applied_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ipa.id,
        ipa.sale_id,
        ipa.amount_applied,
        ipa.applied_date
    FROM invoice_payment_applications ipa
    WHERE ipa.customer_id = get_invoice_payments.customer_id
    ORDER BY ipa.created_at DESC;
END;
$$;

-- Función para crear pago de cliente
CREATE OR REPLACE FUNCTION create_customer_payment(
    p_customer_id UUID,
    p_amount DECIMAL(12,2),
    p_payment_method VARCHAR(20),
    p_notes TEXT,
    p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    payment_id UUID;
BEGIN
    -- Crear el pago
    INSERT INTO customer_payments (
        customer_id,
        amount,
        payment_method,
        notes,
        user_id
    ) VALUES (
        p_customer_id,
        p_amount,
        p_payment_method,
        p_notes,
        p_user_id
    ) RETURNING id INTO payment_id;

    -- Crear movimiento de cuenta corriente
    INSERT INTO customer_account_movements (
        customer_id,
        movement_type,
        reference_number,
        description,
        credit_amount,
        user_id
    ) VALUES (
        p_customer_id,
        'payment',
        'PAG-' || EXTRACT(EPOCH FROM now())::text,
        'Pago recibido - ' || p_payment_method,
        p_amount,
        p_user_id
    );

    RETURN payment_id;
END;
$$;

-- Función para aplicar pago a factura
CREATE OR REPLACE FUNCTION apply_payment_to_invoice(
    p_payment_id UUID,
    p_sale_id UUID,
    p_customer_id UUID,
    p_amount_applied DECIMAL(12,2),
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sale_total DECIMAL(12,2);
    total_paid DECIMAL(12,2);
BEGIN
    -- Obtener total de la venta
    SELECT total INTO sale_total FROM sales WHERE id = p_sale_id;

    -- Crear aplicación de pago
    INSERT INTO invoice_payment_applications (
        payment_id,
        sale_id,
        customer_id,
        amount_applied,
        user_id
    ) VALUES (
        p_payment_id,
        p_sale_id,
        p_customer_id,
        p_amount_applied,
        p_user_id
    );

    -- Calcular total pagado
    SELECT COALESCE(SUM(amount_applied), 0) INTO total_paid
    FROM invoice_payment_applications
    WHERE sale_id = p_sale_id;

    -- Actualizar estado del movimiento
    IF total_paid >= sale_total THEN
        UPDATE customer_account_movements 
        SET status = 'paid'
        WHERE sale_id = p_sale_id AND movement_type = 'sale';
    ELSE
        UPDATE customer_account_movements 
        SET status = 'partial'
        WHERE sale_id = p_sale_id AND movement_type = 'sale';
    END IF;
END;
$$;

-- Permisos para las funciones
GRANT EXECUTE ON FUNCTION get_customer_movements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoice_payments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_customer_payment(UUID, DECIMAL, VARCHAR, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_payment_to_invoice(UUID, UUID, UUID, DECIMAL, UUID) TO authenticated;
