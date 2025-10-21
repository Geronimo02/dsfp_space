-- Add credit management fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_terms text;

-- Create customer_payments table for account movements
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL,
  sale_id uuid,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_payments
CREATE POLICY "Anyone authenticated can view customer payments" 
ON public.customer_payments 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and managers can insert customer payments" 
ON public.customer_payments 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Only admins can delete customer payments" 
ON public.customer_payments 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to update customer balance after payment
CREATE OR REPLACE FUNCTION public.update_customer_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Update customer balance after payment (reduces debt)
  IF TG_OP = 'INSERT' THEN
    UPDATE customers 
    SET current_balance = current_balance - NEW.amount
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for customer payments
DROP TRIGGER IF EXISTS update_customer_balance_trigger ON public.customer_payments;
CREATE TRIGGER update_customer_balance_trigger
  AFTER INSERT ON public.customer_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_balance();

-- Create function to update customer balance after sale (on credit)
CREATE OR REPLACE FUNCTION public.update_customer_balance_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only update balance if payment method is "credit" and customer exists
  IF NEW.payment_method = 'credit' AND NEW.customer_id IS NOT NULL THEN
    UPDATE customers 
    SET current_balance = current_balance + NEW.total
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for sales on credit
DROP TRIGGER IF EXISTS update_customer_balance_on_sale_trigger ON public.sales;
CREATE TRIGGER update_customer_balance_on_sale_trigger
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_balance_on_sale();

-- Add comment
COMMENT ON TABLE public.customer_payments IS 'Customer payments and account movements';
COMMENT ON COLUMN public.customers.credit_limit IS 'Maximum credit allowed for customer';
COMMENT ON COLUMN public.customers.current_balance IS 'Current debt balance (positive = owes money)';