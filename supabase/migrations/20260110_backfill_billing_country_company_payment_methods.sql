-- Backfill billing_country in company_payment_methods from signup_payment_methods
-- 1) Copia directa por referencia de método
update public.company_payment_methods c
set billing_country = s.billing_country
from public.signup_payment_methods s
where c.billing_country is null
  and s.payment_method_ref is not null
  and (
    (c.stripe_payment_method_id is not null and c.stripe_payment_method_id = s.payment_method_ref)
    or (c.mp_preapproval_id is not null and c.mp_preapproval_id = s.payment_method_ref)
  );

-- 2) Fallback AR para MP cuando siga nulo
update public.company_payment_methods c
set billing_country = 'AR'
where c.billing_country is null and c.type = 'mercadopago';

-- 3) Fallback al país de la compañía si sigue nulo y existe
update public.company_payment_methods c
set billing_country = coalesce(c.billing_country, co.country)
from public.companies co
where c.company_id = co.id
  and c.billing_country is null
  and co.country is not null;
