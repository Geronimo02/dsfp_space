-- Create subscription_events table for auditing
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'upgraded', 'downgraded', 'canceled', 'payment_failed', 'payment_recovered'
  old_plan_id UUID REFERENCES public.subscription_plans(id),
  new_plan_id UUID REFERENCES public.subscription_plans(id),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_subscription_events_company_id ON public.subscription_events(company_id);
CREATE INDEX idx_subscription_events_created_at ON public.subscription_events(created_at DESC);

-- Ensure subscriptions table has retry fields for payment failures
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_failed_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payment_retry_after TIMESTAMP,
  ADD COLUMN IF NOT EXISTS disabled_until TIMESTAMP;
