-- Fix exchange_rates unique constraint to be company-scoped
-- Drop old constraint and create new one

ALTER TABLE public.exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_currency_key;

-- Add unique constraint by currency and company_id
ALTER TABLE public.exchange_rates 
  ADD CONSTRAINT exchange_rates_currency_company_key 
  UNIQUE (currency, company_id);

-- Update RLS policies for exchange_rates to be company-scoped
DROP POLICY IF EXISTS "Anyone authenticated can view exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Admins can manage exchange rates" ON public.exchange_rates;

-- New company-scoped policies
CREATE POLICY "Users can view exchange rates of their company"
  ON public.exchange_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = exchange_rates.company_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
    )
  );

CREATE POLICY "Admins can manage exchange rates of their company"
  ON public.exchange_rates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = exchange_rates.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'admin'
      AND cu.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = exchange_rates.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'admin'
      AND cu.active = true
    )
  );
