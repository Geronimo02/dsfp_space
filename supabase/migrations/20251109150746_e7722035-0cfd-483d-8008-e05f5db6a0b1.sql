-- Agregar soporte de moneda extranjera a presupuestos
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ARS';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4) DEFAULT 1.0;

-- Agregar campos para rastrear entregas parciales
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS total_delivered NUMERIC(12,2) DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'pending';

-- Agregar relación de remito a presupuesto
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id);

-- Agregar campos para tracking de cantidades en items de remito
ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS quotation_item_id UUID REFERENCES quotation_items(id);

-- Agregar campos para tracking de entregas en items de presupuesto
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS total_delivered INTEGER DEFAULT 0;

-- Crear tabla para configuración de tipos de cambio
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency VARCHAR(3) NOT NULL,
  rate NUMERIC(10,4) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(currency)
);

-- Insertar tasas de cambio iniciales
INSERT INTO exchange_rates (currency, rate) VALUES 
  ('ARS', 1.0),
  ('USD', 1000.0),
  ('EUR', 1100.0)
ON CONFLICT (currency) DO NOTHING;

-- Habilitar RLS en exchange_rates
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Políticas para exchange_rates
CREATE POLICY "Anyone authenticated can view exchange rates"
  ON exchange_rates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage exchange rates"
  ON exchange_rates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_delivery_notes_quotation ON delivery_notes(quotation_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_quotation_item ON delivery_note_items(quotation_item_id);
CREATE INDEX IF NOT EXISTS idx_quotations_delivery_status ON quotations(delivery_status);