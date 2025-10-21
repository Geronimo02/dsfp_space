-- =============================================
-- MÓDULO DE PRESUPUESTOS Y REMITOS
-- =============================================

-- 1. ENUM PARA ESTADOS DE PRESUPUESTOS
CREATE TYPE quotation_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');

-- 2. ENUM PARA ESTADOS DE REMITOS
CREATE TYPE delivery_status AS ENUM ('pending', 'in_transit', 'delivered', 'cancelled');

-- 3. TABLA DE PRESUPUESTOS
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  status quotation_status DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  discount_rate NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  notes TEXT,
  valid_until DATE,
  converted_to_sale_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. TABLA DE ITEMS DE PRESUPUESTO
CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. TABLA DE REMITOS
CREATE TABLE delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_number TEXT NOT NULL UNIQUE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  status delivery_status DEFAULT 'pending',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  notes TEXT,
  delivery_address TEXT,
  delivery_date TIMESTAMP WITH TIME ZONE,
  received_by TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  signature_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. TABLA DE ITEMS DE REMITO
CREATE TABLE delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_quotations_user_id ON quotations(user_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX idx_delivery_notes_sale_id ON delivery_notes(sale_id);
CREATE INDEX idx_delivery_notes_customer_id ON delivery_notes(customer_id);
CREATE INDEX idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX idx_delivery_notes_created_at ON delivery_notes(created_at DESC);
CREATE INDEX idx_delivery_note_items_delivery_note_id ON delivery_note_items(delivery_note_id);

-- 8. HABILITAR RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;

-- 9. POLÍTICAS RLS - QUOTATIONS
CREATE POLICY "Anyone authenticated can view quotations"
ON quotations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins, managers and accountants can create quotations"
ON quotations FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "Admins and managers can update quotations"
ON quotations FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Only admins can delete quotations"
ON quotations FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. POLÍTICAS RLS - QUOTATION_ITEMS
CREATE POLICY "Anyone authenticated can view quotation items"
ON quotation_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins, managers and accountants can create quotation items"
ON quotation_items FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'accountant'::app_role)
);

-- 11. POLÍTICAS RLS - DELIVERY_NOTES
CREATE POLICY "Anyone authenticated can view delivery notes"
ON delivery_notes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins, managers and employees can create delivery notes"
ON delivery_notes FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'employee'::app_role)
);

CREATE POLICY "Admins and managers can update delivery notes"
ON delivery_notes FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Only admins can delete delivery notes"
ON delivery_notes FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 12. POLÍTICAS RLS - DELIVERY_NOTE_ITEMS
CREATE POLICY "Anyone authenticated can view delivery note items"
ON delivery_note_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins, managers and employees can create delivery note items"
ON delivery_note_items FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'employee'::app_role)
);

-- 13. TRIGGERS DE AUDITORÍA
CREATE TRIGGER audit_quotations
AFTER INSERT OR UPDATE OR DELETE ON quotations
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_delivery_notes
AFTER INSERT OR UPDATE OR DELETE ON delivery_notes
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 14. TRIGGER PARA UPDATED_AT
CREATE TRIGGER update_quotations_updated_at
BEFORE UPDATE ON quotations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_notes_updated_at
BEFORE UPDATE ON delivery_notes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 15. FUNCIÓN PARA GENERAR NÚMERO DE PRESUPUESTO
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM quotations;
  new_number := 'PRES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- 16. FUNCIÓN PARA GENERAR NÚMERO DE REMITO
CREATE OR REPLACE FUNCTION generate_delivery_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM delivery_notes;
  new_number := 'REM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- 17. AGREGAR PERMISOS PARA LOS NUEVOS MÓDULOS
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
-- QUOTATIONS
('admin', 'quotations', true, true, true, true, true),
('manager', 'quotations', true, true, true, false, true),
('accountant', 'quotations', true, true, false, false, true),
('cashier', 'quotations', true, false, false, false, false),
('viewer', 'quotations', true, false, false, false, true),
('employee', 'quotations', true, false, false, false, false),

-- DELIVERY_NOTES
('admin', 'delivery_notes', true, true, true, true, true),
('manager', 'delivery_notes', true, true, true, false, true),
('accountant', 'delivery_notes', true, false, false, false, true),
('cashier', 'delivery_notes', true, true, true, false, false),
('viewer', 'delivery_notes', true, false, false, false, true),
('employee', 'delivery_notes', true, true, false, false, false)
ON CONFLICT (role, module) DO NOTHING;