-- Ensure billing_country exists on company_payment_methods
alter table if exists public.company_payment_methods
  add column if not exists billing_country text;
