-- Tabla para configuración de tickets
CREATE TABLE IF NOT EXISTS ticket_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    logo_url TEXT,
    company_name VARCHAR(200) NOT NULL DEFAULT '',
    company_address TEXT DEFAULT '',
    company_phone VARCHAR(20) DEFAULT '',
    company_email VARCHAR(255) DEFAULT '',
    footer_message TEXT DEFAULT '¡Gracias por su compra!',
    header_color VARCHAR(7) DEFAULT '#1f2937',
    text_color VARCHAR(7) DEFAULT '#374151',
    accent_color VARCHAR(7) DEFAULT '#3b82f6',
    show_logo BOOLEAN DEFAULT true,
    show_qr BOOLEAN DEFAULT true,
    paper_width VARCHAR(10) DEFAULT '80mm',
    font_size VARCHAR(10) DEFAULT 'small',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE ticket_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Permitir a todos los usuarios autenticados
CREATE POLICY "Users can view ticket config"
    ON ticket_config FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage ticket config"
    ON ticket_config FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_ticket_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER ticket_config_updated_at
    BEFORE UPDATE ON ticket_config
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_config_updated_at();

-- Insertar configuración por defecto basada en company_settings si existe
DO $$
BEGIN
    -- Verificar si existe company_settings y ticket_config está vacío
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_settings') 
       AND NOT EXISTS (SELECT 1 FROM ticket_config) THEN
        
        INSERT INTO ticket_config (company_name, company_address, company_phone, company_email)
        SELECT 
            COALESCE(company_name, 'Mi Empresa') as company_name,
            COALESCE(address, '') as company_address,
            COALESCE(phone, '') as company_phone,
            COALESCE(email, '') as company_email
        FROM company_settings
        LIMIT 1;
        
    END IF;
    
    -- Si no existe ninguna configuración, crear una básica
    IF NOT EXISTS (SELECT 1 FROM ticket_config) THEN
        INSERT INTO ticket_config (company_name) VALUES ('Mi Empresa');
    END IF;
END $$;
