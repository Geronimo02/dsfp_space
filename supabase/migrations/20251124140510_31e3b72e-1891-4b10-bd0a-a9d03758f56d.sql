-- Create platform_feedback table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.platform_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'bug', 'feature_request', 'improvement', 'complaint', 'praise'
  category TEXT, -- 'ui', 'performance', 'functionality', 'billing', 'support'
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_review', 'resolved', 'dismissed'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create platform_payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.platform_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.company_subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  payment_method TEXT, -- 'credit_card', 'debit_card', 'bank_transfer', 'cash'
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE,
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Platform admins can view all feedback" ON public.platform_feedback;
DROP POLICY IF EXISTS "Platform admins can update feedback" ON public.platform_feedback;
DROP POLICY IF EXISTS "Users can insert feedback for their company" ON public.platform_feedback;
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.platform_feedback;

DROP POLICY IF EXISTS "Platform admins can manage all payments" ON public.platform_payments;
DROP POLICY IF EXISTS "Company admins can view their payments" ON public.platform_payments;

-- RLS Policies for platform_feedback
CREATE POLICY "Platform admins can view all feedback"
  ON public.platform_feedback
  FOR SELECT
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update feedback"
  ON public.platform_feedback
  FOR UPDATE
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can insert feedback for their company"
  ON public.platform_feedback
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can view their own feedback"
  ON public.platform_feedback
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    is_platform_admin(auth.uid())
  );

-- RLS Policies for platform_payments
CREATE POLICY "Platform admins can manage all payments"
  ON public.platform_payments
  FOR ALL
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Company admins can view their payments"
  ON public.platform_payments
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
      AND active = true
    )
  );

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_platform_feedback_company ON platform_feedback(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_feedback_status ON platform_feedback(status);
CREATE INDEX IF NOT EXISTS idx_platform_feedback_created ON platform_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_payments_company ON platform_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_payments_status ON platform_payments(status);
CREATE INDEX IF NOT EXISTS idx_platform_payments_date ON platform_payments(payment_date DESC);