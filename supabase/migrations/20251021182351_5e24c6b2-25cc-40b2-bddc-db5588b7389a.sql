-- Add policy to allow cashiers to view customers (for POS usage)
-- The customer_pos_view will inherit these permissions
CREATE POLICY "Cashiers can view customers for POS"
ON public.customers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cashier')
);