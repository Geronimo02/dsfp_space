-- Fix customer_payments RLS policy - restrict SELECT to company members only
DROP POLICY IF EXISTS "Anyone authenticated can view customer payments" ON public.customer_payments;

CREATE POLICY "Users can view company customer payments"
ON public.customer_payments
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = auth.uid() AND active = true
  )
);