-- Función mejorada para actualizar saldo después de cada movimiento
CREATE OR REPLACE FUNCTION update_customer_balance()
RETURNS TRIGGER AS $$
DECLARE
    current_balance DECIMAL(12,2);
BEGIN
    -- Calcular el nuevo saldo del cliente
    SELECT COALESCE(SUM(debit_amount - credit_amount), 0) 
    INTO current_balance
    FROM customer_account_movements 
    WHERE customer_id = COALESCE(NEW.customer_id, OLD.customer_id);
    
    -- Actualizar el saldo en la tabla customers
    UPDATE customers 
    SET current_balance = current_balance
    WHERE id = COALESCE(NEW.customer_id, OLD.customer_id);
    
    -- Actualizar el campo balance en cada movimiento para mostrar saldo acumulado
    UPDATE customer_account_movements 
    SET balance = (
        SELECT COALESCE(SUM(cam2.debit_amount - cam2.credit_amount), 0)
        FROM customer_account_movements cam2 
        WHERE cam2.customer_id = customer_account_movements.customer_id 
        AND (cam2.movement_date < customer_account_movements.movement_date 
             OR (cam2.movement_date = customer_account_movements.movement_date 
                 AND cam2.id <= customer_account_movements.id))
    )
    WHERE customer_id = COALESCE(NEW.customer_id, OLD.customer_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
