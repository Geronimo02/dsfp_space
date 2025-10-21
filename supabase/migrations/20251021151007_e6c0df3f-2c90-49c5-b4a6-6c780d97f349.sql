-- Agregar campos adicionales a company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS card_surcharge_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_stock_alert boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS receipt_printer_name text,
ADD COLUMN IF NOT EXISTS receipt_format text DEFAULT 'thermal',
ADD COLUMN IF NOT EXISTS backup_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_backup_date timestamp with time zone;

-- Comentarios para documentación
COMMENT ON COLUMN public.company_settings.card_surcharge_rate IS 'Recargo porcentual aplicado a pagos con tarjeta de crédito';
COMMENT ON COLUMN public.company_settings.low_stock_alert IS 'Activa alertas automáticas cuando productos tienen stock bajo';
COMMENT ON COLUMN public.company_settings.whatsapp_number IS 'Número de WhatsApp para notificaciones';
COMMENT ON COLUMN public.company_settings.whatsapp_enabled IS 'Indica si la integración de WhatsApp está activa';
COMMENT ON COLUMN public.company_settings.receipt_printer_name IS 'Nombre de la impresora configurada para tickets';
COMMENT ON COLUMN public.company_settings.receipt_format IS 'Formato del ticket: thermal (térmico) o a4 (hoja completa)';
COMMENT ON COLUMN public.company_settings.backup_enabled IS 'Indica si los backups automáticos están activados';
COMMENT ON COLUMN public.company_settings.last_backup_date IS 'Fecha del último backup realizado';
