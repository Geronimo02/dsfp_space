-- Create platform feedback table
CREATE TABLE IF NOT EXISTS public.platform_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  category TEXT NOT NULL, -- 'bug', 'feature_request', 'general', 'billing'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved'
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create platform notifications table
CREATE TABLE IF NOT EXISTS public.platform_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'payment_overdue', 'payment_due', 'trial_ending', 'subscription_ending'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_feedback
CREATE POLICY "Platform admins can view all feedback"
ON public.platform_feedback
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update feedback"
ON public.platform_feedback
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Company users can insert feedback"
ON public.platform_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM company_users 
    WHERE user_id = auth.uid() 
      AND active = true
  )
);

CREATE POLICY "Company users can view their feedback"
ON public.platform_feedback
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM company_users 
    WHERE user_id = auth.uid() 
      AND active = true
  )
);

-- RLS Policies for platform_notifications
CREATE POLICY "Platform admins can manage all notifications"
ON public.platform_notifications
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_platform_feedback_company_id ON public.platform_feedback(company_id);
CREATE INDEX idx_platform_feedback_status ON public.platform_feedback(status);
CREATE INDEX idx_platform_notifications_company_id ON public.platform_notifications(company_id);
CREATE INDEX idx_platform_notifications_read ON public.platform_notifications(read);

-- Create trigger for updated_at
CREATE TRIGGER update_platform_feedback_updated_at
BEFORE UPDATE ON public.platform_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check overdue payments and create notifications
CREATE OR REPLACE FUNCTION public.check_overdue_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subscription_rec RECORD;
BEGIN
  FOR subscription_rec IN
    SELECT 
      cs.id,
      cs.company_id,
      cs.next_payment_date,
      cs.amount_due,
      c.name as company_name,
      EXTRACT(DAY FROM (NOW() - cs.next_payment_date))::INTEGER as days_overdue
    FROM company_subscriptions cs
    INNER JOIN companies c ON c.id = cs.company_id
    WHERE cs.status = 'active'
      AND cs.next_payment_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM platform_notifications n
        WHERE n.company_id = cs.company_id
          AND n.notification_type = 'payment_overdue'
          AND n.created_at > now() - INTERVAL '3 days'
      )
  LOOP
    INSERT INTO platform_notifications (
      company_id,
      notification_type,
      title,
      message,
      severity
    ) VALUES (
      subscription_rec.company_id,
      'payment_overdue',
      'Pago Vencido: ' || subscription_rec.company_name,
      'La suscripción está vencida hace ' || subscription_rec.days_overdue || ' días. Monto pendiente: $' || subscription_rec.amount_due,
      CASE 
        WHEN subscription_rec.days_overdue > 30 THEN 'critical'
        WHEN subscription_rec.days_overdue > 7 THEN 'warning'
        ELSE 'info'
      END
    );
  END LOOP;
END;
$$;