-- Migration: Allow 'gmail' as an integration_type value
-- Drops and recreates the check constraint integrations_integration_type_check

BEGIN;

ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_integration_type_check;

ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_integration_type_check
  CHECK (integration_type IN ('mercadolibre', 'tiendanube', 'woocommerce', 'google_forms', 'gmail'));

COMMIT;

-- NOTE: Run this migration against your Supabase/Postgres instance.
-- Example using psql:
-- psql "postgres://user:password@host:port/dbname" -f supabase/migrations/20260106_add_gmail_integration_type.sql
