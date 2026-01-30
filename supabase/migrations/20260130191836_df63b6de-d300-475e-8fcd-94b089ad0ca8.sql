-- Fix PUBLIC_DATA_EXPOSURE: Restrict tax_rates table to authenticated users only
-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "tax_rates_select_public" ON tax_rates;

-- Create a policy that only allows authenticated users to view tax rates
CREATE POLICY "Authenticated users can view tax rates"
ON tax_rates FOR SELECT
USING (auth.uid() IS NOT NULL);