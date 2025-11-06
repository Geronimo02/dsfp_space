-- Eliminar el trigger existente
DROP TRIGGER IF EXISTS trigger_create_sale_account_movement ON sales;

-- Recrear la función corregida
CREATE OR REPLACE FUNCTION create_sale_account_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- SOLO crear movimiento si la venta es a crédito Y tiene cliente
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

-- Recrear el trigger
CREATE TRIGGER trigger_create_sale_account_movement
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION create_sale_account_movement();

-- Limpiar movimientos incorrectos existentes (ventas que no son a crédito)
DELETE FROM customer_account_movements 
WHERE movement_type = 'sale' 
AND sale_id IN (
    SELECT id FROM sales 
    WHERE payment_method != 'credit'
);

-- Recalcular saldos de clientes
UPDATE customers 
SET current_balance = (
    SELECT COALESCE(SUM(debit_amount - credit_amount), 0)
    FROM customer_account_movements 
    WHERE customer_id = customers.id
);
