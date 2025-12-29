-- =============================================
-- SECURITY FIX: Part 2 - Drop and recreate functions
-- =============================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_customer_movements(uuid);
DROP FUNCTION IF EXISTS public.get_all_customer_movements(text);
DROP FUNCTION IF EXISTS public.check_low_stock_alerts();
DROP FUNCTION IF EXISTS public.check_expiring_products();
DROP FUNCTION IF EXISTS public.create_customer_payment(uuid, numeric, text, text, uuid);
DROP FUNCTION IF EXISTS public.apply_payment_to_invoice(uuid, numeric, text);

-- =============================================
-- 3. Recreate get_customer_movements with company verification
-- =============================================

CREATE FUNCTION public.get_customer_movements(p_customer_id uuid)
RETURNS TABLE(
  id uuid, 
  movement_date timestamp with time zone, 
  movement_type character varying, 
  reference_number character varying, 
  description text, 
  debit_amount numeric, 
  credit_amount numeric, 
  balance numeric, 
  status character varying
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify user belongs to the customer's company
    IF NOT EXISTS (
      SELECT 1 FROM customers c
      JOIN company_users cu ON cu.company_id = c.company_id
      WHERE c.id = p_customer_id
        AND cu.user_id = auth.uid()
        AND cu.active = true
    ) THEN
      RAISE EXCEPTION 'No tienes acceso a este cliente';
    END IF;

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
    WHERE cam.customer_id = p_customer_id
    ORDER BY cam.movement_date DESC;
END;
$$;

-- =============================================
-- 4. Recreate get_all_customer_movements with company verification
-- =============================================

CREATE FUNCTION public.get_all_customer_movements(search_query text DEFAULT NULL::text)
RETURNS TABLE(
  id uuid, 
  customer_id uuid, 
  customer_name character varying, 
  movement_date timestamp with time zone, 
  movement_type character varying, 
  reference_number character varying, 
  description text, 
  debit_amount numeric, 
  credit_amount numeric, 
  balance numeric, 
  status character varying, 
  sale_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_ids uuid[];
BEGIN
    -- Get user's companies
    SELECT array_agg(cu.company_id) INTO user_company_ids
    FROM company_users cu
    WHERE cu.user_id = auth.uid() AND cu.active = true;

    -- If user has no companies, return empty
    IF user_company_ids IS NULL THEN
      RETURN;
    END IF;

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
    WHERE c.company_id = ANY(user_company_ids)
      AND (search_query IS NULL OR c.name ILIKE '%' || search_query || '%')
    ORDER BY cam.movement_date DESC, cam.id DESC;
END;
$$;

-- =============================================
-- 5. Recreate check_low_stock_alerts with company isolation
-- =============================================

CREATE FUNCTION public.check_low_stock_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  low_stock_product RECORD;
  company_admin RECORD;
BEGIN
  -- Iterate per company to maintain isolation
  FOR company_admin IN
    SELECT DISTINCT cu.company_id, cu.user_id
    FROM company_users cu
    WHERE cu.role IN ('admin', 'manager') AND cu.active = true
  LOOP
    -- Find low stock products for THIS company only
    FOR low_stock_product IN
      SELECT p.id, p.name, p.stock, p.min_stock, p.sku
      FROM products p
      WHERE p.active = true
        AND p.company_id = company_admin.company_id
        AND p.stock <= p.min_stock
        AND p.min_stock > 0
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'low_stock'
            AND (n.data->>'product_id')::uuid = p.id
            AND n.created_at > now() - INTERVAL '24 hours'
        )
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        company_id
      ) VALUES (
        company_admin.user_id,
        'low_stock',
        'Stock Bajo: ' || low_stock_product.name,
        'El producto ' || low_stock_product.name || ' tiene stock bajo (' || 
        low_stock_product.stock || ' unidades). Mínimo: ' || low_stock_product.min_stock,
        jsonb_build_object(
          'product_id', low_stock_product.id,
          'product_name', low_stock_product.name,
          'current_stock', low_stock_product.stock,
          'min_stock', low_stock_product.min_stock,
          'sku', low_stock_product.sku
        ),
        company_admin.company_id
      );
    END LOOP;
  END LOOP;
END;
$$;

-- =============================================
-- 6. Recreate check_expiring_products with company isolation
-- =============================================

CREATE FUNCTION public.check_expiring_products()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expiring_product RECORD;
  company_admin RECORD;
BEGIN
  -- Iterate per company to maintain isolation
  FOR company_admin IN
    SELECT DISTINCT cu.company_id, cu.user_id
    FROM company_users cu
    WHERE cu.role IN ('admin', 'manager') AND cu.active = true
  LOOP
    -- Find expiring products for THIS company only
    FOR expiring_product IN
      SELECT p.id, p.name, p.expiration_date, p.batch_number, p.stock
      FROM products p
      WHERE p.active = true
        AND p.company_id = company_admin.company_id
        AND p.expiration_date IS NOT NULL
        AND p.expiration_date <= (CURRENT_DATE + INTERVAL '30 days')
        AND p.expiration_date >= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'expiring_product'
            AND (n.data->>'product_id')::uuid = p.id
            AND n.created_at > now() - INTERVAL '7 days'
        )
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        company_id
      ) VALUES (
        company_admin.user_id,
        'expiring_product',
        'Producto Próximo a Vencer: ' || expiring_product.name,
        'El producto ' || expiring_product.name || ' (Lote: ' || 
        COALESCE(expiring_product.batch_number, 'N/A') || ') vence el ' || 
        TO_CHAR(expiring_product.expiration_date, 'DD/MM/YYYY'),
        jsonb_build_object(
          'product_id', expiring_product.id,
          'product_name', expiring_product.name,
          'expiration_date', expiring_product.expiration_date,
          'batch_number', expiring_product.batch_number,
          'stock', expiring_product.stock
        ),
        company_admin.company_id
      );
    END LOOP;
  END LOOP;
END;
$$;

-- =============================================
-- 7. Recreate create_customer_payment with company verification
-- =============================================

CREATE FUNCTION public.create_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text DEFAULT NULL,
  p_sale_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_payment_id uuid;
BEGIN
  -- Get customer's company and verify access
  SELECT c.company_id INTO v_company_id
  FROM customers c
  WHERE c.id = p_customer_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  -- Verify user belongs to this company
  IF NOT EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.company_id = v_company_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para registrar pagos de este cliente';
  END IF;

  -- Create the payment
  INSERT INTO customer_payments (
    customer_id,
    company_id,
    amount,
    payment_method,
    notes,
    sale_id,
    user_id,
    payment_date
  ) VALUES (
    p_customer_id,
    v_company_id,
    p_amount,
    p_payment_method,
    p_notes,
    p_sale_id,
    auth.uid(),
    now()
  )
  RETURNING id INTO v_payment_id;

  -- Update customer balance
  UPDATE customers
  SET current_balance = COALESCE(current_balance, 0) - p_amount
  WHERE id = p_customer_id;

  RETURN v_payment_id;
END;
$$;

-- =============================================
-- 8. Recreate apply_payment_to_invoice with company verification
-- =============================================

CREATE FUNCTION public.apply_payment_to_invoice(
  p_movement_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement RECORD;
  v_company_id uuid;
  v_remaining numeric;
BEGIN
  -- Get movement details
  SELECT cam.*, c.company_id as customer_company_id
  INTO v_movement
  FROM customer_account_movements cam
  JOIN customers c ON c.id = cam.customer_id
  WHERE cam.id = p_movement_id;

  IF v_movement IS NULL THEN
    RAISE EXCEPTION 'Movimiento no encontrado';
  END IF;

  v_company_id := v_movement.customer_company_id;

  -- Verify user belongs to this company
  IF NOT EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.company_id = v_company_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para aplicar pagos a este movimiento';
  END IF;

  -- Calculate remaining amount
  v_remaining := COALESCE(v_movement.debit_amount, 0) - COALESCE(v_movement.credit_amount, 0);

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'El monto excede el saldo pendiente';
  END IF;

  -- Create payment record
  INSERT INTO customer_payments (
    customer_id,
    company_id,
    amount,
    payment_method,
    sale_id,
    user_id,
    payment_date,
    notes
  ) VALUES (
    v_movement.customer_id,
    v_company_id,
    p_amount,
    p_payment_method,
    v_movement.sale_id,
    auth.uid(),
    now(),
    'Pago aplicado a factura ' || COALESCE(v_movement.reference_number, v_movement.id::text)
  );

  -- Update movement status
  UPDATE customer_account_movements
  SET 
    credit_amount = COALESCE(credit_amount, 0) + p_amount,
    status = CASE 
      WHEN COALESCE(credit_amount, 0) + p_amount >= COALESCE(debit_amount, 0) THEN 'paid'
      ELSE 'partial'
    END,
    updated_at = now()
  WHERE id = p_movement_id;

  -- Update customer balance
  UPDATE customers
  SET current_balance = COALESCE(current_balance, 0) - p_amount
  WHERE id = v_movement.customer_id;

  RETURN true;
END;
$$;