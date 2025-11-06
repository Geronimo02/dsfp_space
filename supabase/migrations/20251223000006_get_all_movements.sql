-- Función para obtener todos los movimientos de cuenta corriente con información del cliente
CREATE OR REPLACE FUNCTION get_all_customer_movements(search_query TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    customer_name VARCHAR(200),
    movement_date TIMESTAMP WITH TIME ZONE,
    movement_type VARCHAR(50),
    reference_number VARCHAR(100),
    description TEXT,
    debit_amount DECIMAL(12,2),
    credit_amount DECIMAL(12,2),
    balance DECIMAL(12,2),
    status VARCHAR(20),
    sale_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cam.id,
        cam.customer_id,
        c.name as customer_name,
        cam.movement_date,
        cam.movement_type,
        cam.reference_number,
        cam.description,
        cam.debit_amount,
        cam.credit_amount,
        cam.balance,
        cam.status,
        cam.sale_id
    FROM customer_account_movements cam
    INNER JOIN customers c ON c.id = cam.customer_id
    WHERE (search_query IS NULL OR c.name ILIKE '%' || search_query || '%')
    ORDER BY cam.movement_date DESC, cam.id DESC;
END;
$$;

-- Permisos para la función
GRANT EXECUTE ON FUNCTION get_all_customer_movements(TEXT) TO authenticated;
