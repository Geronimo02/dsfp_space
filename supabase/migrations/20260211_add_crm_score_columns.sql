-- Ensure CRM scoring columns exist on opportunities
ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS score_total INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS crm_opportunities_score_total_idx ON public.crm_opportunities (score_total);
CREATE INDEX IF NOT EXISTS crm_opportunities_score_updated_at_idx ON public.crm_opportunities (score_updated_at);
