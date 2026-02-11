
-- Add business_niche to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS business_niche text;

-- Create onboarding checklist progress table
CREATE TABLE public.onboarding_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, item_key)
);

ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company checklist"
ON public.onboarding_checklist_items FOR SELECT
USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

CREATE POLICY "Users can update their company checklist"
ON public.onboarding_checklist_items FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

CREATE POLICY "Users can modify their company checklist"
ON public.onboarding_checklist_items FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- Add dismissed flag on company_onboarding
ALTER TABLE public.company_onboarding ADD COLUMN IF NOT EXISTS onboarding_dismissed boolean DEFAULT false;
