-- Add DELETE policies for financial tables to prevent unauthorized deletion

-- Only admins can delete purchases (for rare corrections only)
CREATE POLICY "Only admins can delete purchases" 
ON public.purchases FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete purchase items
CREATE POLICY "Only admins can delete purchase items" 
ON public.purchase_items FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete supplier payments
CREATE POLICY "Only admins can delete supplier payments" 
ON public.supplier_payments FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));