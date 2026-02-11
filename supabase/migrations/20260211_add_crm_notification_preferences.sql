-- Add CRM notification preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS crm_stage_changed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS crm_auto_assign BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS crm_sla_assigned BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS crm_reminder_created BOOLEAN DEFAULT true;

-- Update get_users_to_notify to include CRM notifications
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
      (_notification_type = 'expiring_check' AND COALESCE(np.expiring_checks, true)) OR
      (_notification_type = 'crm_stage_changed' AND COALESCE(np.crm_stage_changed, true)) OR
      (_notification_type = 'crm_auto_assign' AND COALESCE(np.crm_auto_assign, true)) OR
      (_notification_type = 'crm_sla_assigned' AND COALESCE(np.crm_sla_assigned, true)) OR
      (_notification_type = 'crm_reminder_created' AND COALESCE(np.crm_reminder_created, true))
    );
END;
$$;

-- Function to get a specific user notification settings
CREATE OR REPLACE FUNCTION public.get_user_notification_target(
  _company_id UUID,
  _user_id UUID,
  _notification_type TEXT
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  email_enabled BOOLEAN
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
    COALESCE(np.email_enabled, true) as email_enabled
  FROM company_users cu
  INNER JOIN auth.users u ON u.id = cu.user_id
  INNER JOIN profiles p ON p.id = cu.user_id
  LEFT JOIN notification_preferences np ON np.user_id = cu.user_id AND np.company_id = cu.company_id
  WHERE cu.company_id = _company_id
    AND cu.user_id = _user_id
    AND cu.active = true
    AND (
      (_notification_type = 'crm_stage_changed' AND COALESCE(np.crm_stage_changed, true)) OR
      (_notification_type = 'crm_auto_assign' AND COALESCE(np.crm_auto_assign, true)) OR
      (_notification_type = 'crm_sla_assigned' AND COALESCE(np.crm_sla_assigned, true)) OR
      (_notification_type = 'crm_reminder_created' AND COALESCE(np.crm_reminder_created, true)) OR
      (_notification_type NOT IN ('crm_stage_changed','crm_auto_assign','crm_sla_assigned','crm_reminder_created'))
    )
  LIMIT 1;
END;
$$;

-- Function to create a notification (bypass RLS)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _company_id UUID,
  _type TEXT,
  _title TEXT,
  _message TEXT,
  _data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO notifications (user_id, company_id, type, title, message, data)
  VALUES (_user_id, _company_id, _type, _title, _message, _data)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;
