-- Función para detectar clientes inactivos (no compran hace 60+ días)
CREATE OR REPLACE FUNCTION public.check_inactive_customers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inactive_customer RECORD;
  days_threshold INTEGER := 60;
BEGIN
  -- Buscar clientes que no compran hace más de 60 días
  FOR inactive_customer IN
    SELECT 
      c.id,
      c.name,
      c.company_id,
      MAX(s.created_at) as last_purchase_date,
      EXTRACT(DAY FROM (NOW() - MAX(s.created_at)))::INTEGER as days_since_purchase
    FROM customers c
    INNER JOIN sales s ON s.customer_id = c.id
    WHERE s.status = 'completed'
    GROUP BY c.id, c.name, c.company_id
    HAVING MAX(s.created_at) < (NOW() - INTERVAL '60 days')
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.type = 'inactive_customer'
          AND (n.data->>'customer_id')::uuid = c.id
          AND n.created_at > now() - INTERVAL '7 days'
      )
  LOOP
    -- Crear notificación para administradores de la empresa
    INSERT INTO notifications (
      company_id,
      type,
      title,
      message,
      data
    ) 
    SELECT 
      inactive_customer.company_id,
      'inactive_customer',
      'Cliente Inactivo: ' || inactive_customer.name,
      'Hace ' || inactive_customer.days_since_purchase || ' días que ' || inactive_customer.name || ' no realiza compras. Última compra: ' || TO_CHAR(inactive_customer.last_purchase_date, 'DD/MM/YYYY'),
      jsonb_build_object(
        'customer_id', inactive_customer.id,
        'customer_name', inactive_customer.name,
        'days_inactive', inactive_customer.days_since_purchase,
        'last_purchase_date', inactive_customer.last_purchase_date
      )
    FROM company_users cu
    WHERE cu.company_id = inactive_customer.company_id
      AND cu.role IN ('admin', 'manager')
      AND cu.active = true;
  END LOOP;
END;
$$;

-- Función para detectar facturas vencidas y cuentas corrientes atrasadas
CREATE OR REPLACE FUNCTION public.check_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  overdue_movement RECORD;
BEGIN
  -- Buscar movimientos de cuenta corriente vencidos
  FOR overdue_movement IN
    SELECT 
      cam.id,
      cam.customer_id,
      c.name as customer_name,
      cam.due_date,
      cam.debit_amount,
      cam.reference_number,
      cam.company_id,
      EXTRACT(DAY FROM (NOW() - cam.due_date))::INTEGER as days_overdue
    FROM customer_account_movements cam
    INNER JOIN customers c ON c.id = cam.customer_id
    WHERE cam.status IN ('pending', 'partial')
      AND cam.due_date IS NOT NULL
      AND cam.due_date < CURRENT_DATE
      AND cam.debit_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.type = 'overdue_invoice'
          AND (n.data->>'movement_id')::uuid = cam.id
          AND n.created_at > now() - INTERVAL '3 days'
      )
  LOOP
    -- Crear notificación para administradores y contadores
    INSERT INTO notifications (
      company_id,
      type,
      title,
      message,
      data
    )
    SELECT 
      overdue_movement.company_id,
      'overdue_invoice',
      'Factura Vencida: ' || overdue_movement.customer_name,
      'La factura ' || overdue_movement.reference_number || ' de ' || overdue_movement.customer_name || ' está vencida hace ' || overdue_movement.days_overdue || ' días. Monto: $' || overdue_movement.debit_amount,
      jsonb_build_object(
        'movement_id', overdue_movement.id,
        'customer_id', overdue_movement.customer_id,
        'customer_name', overdue_movement.customer_name,
        'reference_number', overdue_movement.reference_number,
        'amount', overdue_movement.debit_amount,
        'due_date', overdue_movement.due_date,
        'days_overdue', overdue_movement.days_overdue
      )
    FROM company_users cu
    WHERE cu.company_id = overdue_movement.company_id
      AND cu.role IN ('admin', 'manager', 'accountant')
      AND cu.active = true;
  END LOOP;
END;
$$;