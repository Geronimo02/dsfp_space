-- Add required contact fields to CRM opportunities and relax pipeline/stage requirements
ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Backfill from customers when available
UPDATE public.crm_opportunities o
SET
  email = COALESCE(o.email, c.email),
  phone = COALESCE(o.phone, c.phone)
FROM public.customers c
WHERE o.customer_id = c.id;

-- Ensure not null (use empty string when missing)
UPDATE public.crm_opportunities
SET
  email = COALESCE(email, ''),
  phone = COALESCE(phone, '')
WHERE email IS NULL OR phone IS NULL;

ALTER TABLE public.crm_opportunities
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL;

-- Pipeline optional and stage optional
ALTER TABLE public.crm_opportunities
  ALTER COLUMN stage DROP NOT NULL,
  ALTER COLUMN stage DROP DEFAULT;

-- Customer optional (only name/email/phone required in the form)
ALTER TABLE public.crm_opportunities
  ALTER COLUMN customer_id DROP NOT NULL;
