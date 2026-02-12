-- Indexes to speed up company_users lookups used by CRM RLS
CREATE INDEX IF NOT EXISTS company_users_user_id_idx
  ON public.company_users (user_id);

CREATE INDEX IF NOT EXISTS company_users_user_company_idx
  ON public.company_users (user_id, company_id);

CREATE INDEX IF NOT EXISTS company_users_user_created_idx
  ON public.company_users (user_id, created_at);
