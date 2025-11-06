-- Actualizar la función para calcular saldo acumulado correctamente
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
        -- Calcular saldo acumulado hasta esta fecha
        (SELECT COALESCE(SUM(cam2.debit_amount - cam2.credit_amount), 0)
         FROM customer_account_movements cam2 
         WHERE cam2.customer_id = get_customer_movements.customer_id 
         AND cam2.movement_date <= cam.movement_date
         AND cam2.id <= cam.id) as balance,
        cam.status
    FROM customer_account_movements cam
    WHERE cam.customer_id = get_customer_movements.customer_id
    ORDER BY cam.movement_date DESC, cam.id DESC;
END;
$$;

-- Recalcular los saldos acumulados para todos los movimientos existentes
UPDATE customer_account_movements 
SET balance = (
    SELECT COALESCE(SUM(cam2.debit_amount - cam2.credit_amount), 0)
    FROM customer_account_movements cam2 
    WHERE cam2.customer_id = customer_account_movements.customer_id 
    AND (cam2.movement_date < customer_account_movements.movement_date 
         OR (cam2.movement_date = customer_account_movements.movement_date 
             AND cam2.id <= customer_account_movements.id))
);
