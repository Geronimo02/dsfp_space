-- Crear tabla de configuración de tipos de cambio
CREATE TABLE exchange_rate_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  auto_update BOOLEAN DEFAULT true,
  update_frequency VARCHAR(20) DEFAULT 'daily',
  source VARCHAR(50) DEFAULT 'banco_nacion',
  last_update TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id)
);

-- Crear tabla de histórico de cambios
CREATE TABLE exchange_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL,
  old_rate NUMERIC(12,4),
  new_rate NUMERIC(12,4) NOT NULL,
  source VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE exchange_rate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_history ENABLE ROW LEVEL SECURITY;

-- Políticas para exchange_rate_settings
CREATE POLICY "Users can view their company's exchange rate settings"
  ON exchange_rate_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = exchange_rate_settings.company_id
        AND cu.user_id = auth.uid()
        AND cu.active = true
    )
  );

CREATE POLICY "Admins can manage their company's exchange rate settings"
  ON exchange_rate_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = exchange_rate_settings.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- Políticas para exchange_rate_history
CREATE POLICY "Users can view their company's exchange rate history"
  ON exchange_rate_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = exchange_rate_history.company_id
        AND cu.user_id = auth.uid()
        AND cu.active = true
    )
  );

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_exchange_rate_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_exchange_rate_settings_updated_at
  BEFORE UPDATE ON exchange_rate_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_exchange_rate_settings_updated_at();