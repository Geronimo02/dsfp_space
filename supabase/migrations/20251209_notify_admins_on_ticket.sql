-- =============================================
-- Trigger para notificar a admins cuando se crea un ticket
-- =============================================

-- Crear función que notifique a admins
CREATE OR REPLACE FUNCTION notify_admins_on_ticket()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
  company_name TEXT;
BEGIN
  -- Obtener nombre de la empresa
  SELECT name INTO company_name 
  FROM companies 
  WHERE id = NEW.company_id;

  -- Crear notificación para cada admin activo
  INSERT INTO platform_notifications (user_id, type, title, message, related_id, read)
  SELECT 
    pa.user_id,
    'new_support_ticket',
    'Nuevo Ticket: ' || company_name,
    company_name || ' ha creado un nuevo ticket: ' || NEW.subject,
    NEW.id,
    false
  FROM platform_admins pa
  WHERE pa.active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_notify_admins_on_ticket ON platform_support_tickets;
CREATE TRIGGER trigger_notify_admins_on_ticket
AFTER INSERT ON platform_support_tickets
FOR EACH ROW
EXECUTE FUNCTION notify_admins_on_ticket();

-- =============================================
-- Test: Verificar que el trigger existe
-- =============================================
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE event_object_table = 'platform_support_tickets';
