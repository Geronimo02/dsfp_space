-- Add missing AFIP integration columns to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS cuit VARCHAR(11),
ADD COLUMN IF NOT EXISTS afip_certificate TEXT,
ADD COLUMN IF NOT EXISTS afip_private_key TEXT,
ADD COLUMN IF NOT EXISTS afip_ambiente VARCHAR(20) DEFAULT 'testing',
ADD COLUMN IF NOT EXISTS afip_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.cuit IS 'CUIT for AFIP integration (11 digits)';
COMMENT ON COLUMN public.companies.afip_certificate IS 'Base64 encoded AFIP certificate';
COMMENT ON COLUMN public.companies.afip_private_key IS 'Base64 encoded AFIP private key (encrypted)';
COMMENT ON COLUMN public.companies.afip_ambiente IS 'AFIP environment: testing or production';
COMMENT ON COLUMN public.companies.afip_enabled IS 'Whether AFIP electronic invoicing is enabled';