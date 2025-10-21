-- Tabla de promociones y descuentos
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'volume')),
  value NUMERIC NOT NULL,
  min_quantity INTEGER DEFAULT 1,
  min_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  applies_to TEXT CHECK (applies_to IN ('all', 'product', 'category')),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de devoluciones
CREATE TABLE IF NOT EXISTS public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT UNIQUE NOT NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  refund_method TEXT CHECK (refund_method IN ('cash', 'card', 'credit_note', 'exchange')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de items de devolución
CREATE TABLE IF NOT EXISTS public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de notas de crédito
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT UNIQUE NOT NULL,
  return_id UUID REFERENCES public.returns(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  used_amount NUMERIC DEFAULT 0,
  balance NUMERIC NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Función para generar número de devolución
CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.returns;
  new_number := 'DEV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Función para generar número de nota de crédito
CREATE OR REPLACE FUNCTION public.generate_credit_note_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.credit_notes;
  new_number := 'NC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Trigger para actualizar stock cuando se aprueba una devolución
CREATE OR REPLACE FUNCTION public.update_stock_on_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Reincorporar stock de los productos devueltos
    UPDATE products p
    SET stock = p.stock + ri.quantity
    FROM return_items ri
    WHERE ri.return_id = NEW.id 
      AND ri.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_on_return
  AFTER UPDATE ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_return();

-- RLS Policies
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- Promotions policies
CREATE POLICY "Anyone authenticated can view promotions"
  ON public.promotions FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage promotions"
  ON public.promotions FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Returns policies
CREATE POLICY "Anyone authenticated can view returns"
  ON public.returns FOR SELECT
  USING (true);

CREATE POLICY "Anyone authenticated can create returns"
  ON public.returns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can update returns"
  ON public.returns FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Only admins can delete returns"
  ON public.returns FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Return items policies
CREATE POLICY "Anyone authenticated can view return items"
  ON public.return_items FOR SELECT
  USING (true);

CREATE POLICY "Anyone authenticated can create return items"
  ON public.return_items FOR INSERT
  WITH CHECK (true);

-- Credit notes policies
CREATE POLICY "Customers can view their own credit notes"
  ON public.credit_notes FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage credit notes"
  ON public.credit_notes FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Audit triggers
CREATE TRIGGER audit_promotions
  AFTER INSERT OR UPDATE OR DELETE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_returns
  AFTER INSERT OR UPDATE OR DELETE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_credit_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Permisos para módulos
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES 
  ('admin', 'promotions', true, true, true, true, true),
  ('manager', 'promotions', true, true, true, false, true),
  ('employee', 'promotions', true, false, false, false, false),
  ('accountant', 'promotions', true, false, false, false, true),
  
  ('admin', 'returns', true, true, true, true, true),
  ('manager', 'returns', true, true, true, false, true),
  ('employee', 'returns', true, true, false, false, false),
  ('accountant', 'returns', true, false, false, false, true),
  
  ('admin', 'credit_notes', true, true, true, true, true),
  ('manager', 'credit_notes', true, true, true, false, true),
  ('employee', 'credit_notes', true, false, false, false, false),
  ('accountant', 'credit_notes', true, false, false, false, true)
ON CONFLICT (role, module) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_export = EXCLUDED.can_export;