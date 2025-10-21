-- Create suppliers table
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  tax_id text,
  credit_limit numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  payment_terms text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create purchases table (compras a proveedores)
CREATE TABLE public.purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  purchase_date timestamp with time zone NOT NULL DEFAULT now(),
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  total numeric NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create purchase items table
CREATE TABLE public.purchase_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create supplier payments table
CREATE TABLE public.supplier_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Anyone authenticated can view suppliers"
ON public.suppliers FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can insert suppliers"
ON public.suppliers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can update suppliers"
ON public.suppliers FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can delete suppliers"
ON public.suppliers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for purchases
CREATE POLICY "Anyone authenticated can view purchases"
ON public.purchases FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can insert purchases"
ON public.purchases FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can update purchases"
ON public.purchases FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for purchase_items
CREATE POLICY "Anyone authenticated can view purchase items"
ON public.purchase_items FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can insert purchase items"
ON public.purchase_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for supplier_payments
CREATE POLICY "Anyone authenticated can view supplier payments"
ON public.supplier_payments FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can insert supplier payments"
ON public.supplier_payments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update supplier balance
CREATE OR REPLACE FUNCTION public.update_supplier_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update supplier balance after payment
  IF TG_OP = 'INSERT' THEN
    UPDATE suppliers 
    SET current_balance = current_balance - NEW.amount
    WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_supplier_balance_trigger
AFTER INSERT ON public.supplier_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_supplier_balance();