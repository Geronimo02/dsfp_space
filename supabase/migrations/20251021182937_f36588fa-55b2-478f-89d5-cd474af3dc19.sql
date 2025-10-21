-- Add validation to update_customer_balance_on_sale function
CREATE OR REPLACE FUNCTION public.update_customer_balance_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  customer_credit_limit NUMERIC;
  new_balance NUMERIC;
BEGIN
  -- Only update balance if payment method is "credit" and customer exists
  IF NEW.payment_method = 'credit' AND NEW.customer_id IS NOT NULL THEN
    -- Get customer's credit limit and current balance
    SELECT credit_limit, current_balance 
    INTO customer_credit_limit, new_balance
    FROM customers 
    WHERE id = NEW.customer_id;
    
    -- Calculate new balance
    new_balance := new_balance + NEW.total;
    
    -- Validate credit limit (if set)
    IF customer_credit_limit > 0 AND new_balance > customer_credit_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded. Limit: %, New balance would be: %', 
        customer_credit_limit, new_balance;
    END IF;
    
    -- Validate amount is positive
    IF NEW.total <= 0 THEN
      RAISE EXCEPTION 'Sale total must be positive';
    END IF;
    
    -- Update balance
    UPDATE customers 
    SET current_balance = new_balance
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add validation to update_customer_balance function
CREATE OR REPLACE FUNCTION public.update_customer_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate payment amount is positive
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;
  
  -- Update customer balance after payment (reduces debt)
  IF TG_OP = 'INSERT' THEN
    UPDATE customers 
    SET current_balance = current_balance - NEW.amount
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add validation to update_supplier_balance function
CREATE OR REPLACE FUNCTION public.update_supplier_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate payment amount is positive
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;
  
  -- Update supplier balance after payment
  IF TG_OP = 'INSERT' THEN
    UPDATE suppliers 
    SET current_balance = current_balance - NEW.amount
    WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add validation to update_stock_on_return function
CREATE OR REPLACE FUNCTION public.update_stock_on_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Validate quantities are positive before restocking
    IF EXISTS (
      SELECT 1 FROM return_items 
      WHERE return_id = NEW.id AND quantity <= 0
    ) THEN
      RAISE EXCEPTION 'Return items must have positive quantities';
    END IF;
    
    -- Reincorporate stock of returned products
    UPDATE products p
    SET stock = p.stock + ri.quantity
    FROM return_items ri
    WHERE ri.return_id = NEW.id 
      AND ri.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$function$;