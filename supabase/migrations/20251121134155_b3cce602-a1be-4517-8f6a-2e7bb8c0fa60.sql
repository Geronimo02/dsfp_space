-- Add notification preferences to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_whatsapp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS notification_low_stock BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_expiring_products BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_inactive_customers BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_overdue_invoices BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_expiring_checks BOOLEAN DEFAULT true;

-- Create notification_preferences table for more granular control
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  whatsapp_number TEXT,
  low_stock BOOLEAN DEFAULT true,
  expiring_products BOOLEAN DEFAULT true,
  inactive_customers BOOLEAN DEFAULT true,
  overdue_invoices BOOLEAN DEFAULT true,
  expiring_checks BOOLEAN DEFAULT true,
  daily_summary BOOLEAN DEFAULT false,
  weekly_summary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Create indexes
CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_company_id ON public.notification_preferences(company_id);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get users to notify based on preferences
CREATE OR REPLACE FUNCTION public.get_users_to_notify(
  _company_id UUID,
  _notification_type TEXT,
  _roles app_role[] DEFAULT ARRAY['admin', 'manager', 'accountant']::app_role[]
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  email_enabled BOOLEAN,
  whatsapp_enabled BOOLEAN,
  whatsapp_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cu.user_id,
    u.email,
    p.full_name,
    COALESCE(np.email_enabled, true) as email_enabled,
    COALESCE(np.whatsapp_enabled, false) as whatsapp_enabled,
    np.whatsapp_number
  FROM company_users cu
  INNER JOIN auth.users u ON u.id = cu.user_id
  INNER JOIN profiles p ON p.id = cu.user_id
  LEFT JOIN notification_preferences np ON np.user_id = cu.user_id AND np.company_id = cu.company_id
  WHERE cu.company_id = _company_id
    AND cu.role = ANY(_roles)
    AND cu.active = true
    AND (
      (_notification_type = 'low_stock' AND COALESCE(np.low_stock, true)) OR
      (_notification_type = 'expiring_product' AND COALESCE(np.expiring_products, true)) OR
      (_notification_type = 'inactive_customer' AND COALESCE(np.inactive_customers, true)) OR
      (_notification_type = 'overdue_invoice' AND COALESCE(np.overdue_invoices, true)) OR
      (_notification_type = 'expiring_check' AND COALESCE(np.expiring_checks, true))
    );
END;
$$;