-- Fix the notify_admins_on_ticket function to use correct column names
CREATE OR REPLACE FUNCTION notify_admins_on_ticket()
RETURNS TRIGGER AS $$
DECLARE
  company_name TEXT;
BEGIN
  -- Get company name
  SELECT name INTO company_name 
  FROM companies 
  WHERE id = NEW.company_id;

  -- Create notification using the correct columns
  INSERT INTO platform_notifications (
    company_id, 
    notification_type, 
    title, 
    message, 
    severity, 
    read
  )
  VALUES (
    NEW.company_id,
    'new_support_ticket',
    'Nuevo Ticket: ' || COALESCE(company_name, 'Empresa'),
    COALESCE(company_name, 'Una empresa') || ' ha creado un nuevo ticket: ' || COALESCE(NEW.subject, 'Sin asunto'),
    CASE 
      WHEN NEW.priority = 'high' THEN 'error'
      WHEN NEW.priority = 'medium' THEN 'warning'
      ELSE 'info'
    END,
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;