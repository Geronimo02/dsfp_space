-- Crear tabla de categorías de gastos
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crear tabla de gastos
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number TEXT UNIQUE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'check')),
  reference_number TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  notes TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Función para generar número de gasto
CREATE OR REPLACE FUNCTION public.generate_expense_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.expenses;
  new_number := 'GAS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$function$;

-- Habilitar RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Políticas para expense_categories
CREATE POLICY "Users can view expense categories"
  ON public.expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage expense categories"
  ON public.expense_categories FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'expenses', 'create'))
  WITH CHECK (public.has_permission(auth.uid(), 'expenses', 'create'));

-- Políticas para expenses
CREATE POLICY "Users can view expenses based on permissions"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'expenses', 'view'));

CREATE POLICY "Users can create expenses based on permissions"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'expenses', 'create'));

CREATE POLICY "Users can update expenses based on permissions"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'expenses', 'edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'expenses', 'edit'));

CREATE POLICY "Users can delete expenses based on permissions"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'expenses', 'delete'));

-- Trigger para updated_at
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para audit logs
CREATE TRIGGER audit_expense_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Insertar categorías por defecto
INSERT INTO public.expense_categories (name, description, color) VALUES
  ('Servicios Públicos', 'Electricidad, agua, internet, etc.', '#3B82F6'),
  ('Alquiler', 'Alquiler de local o instalaciones', '#8B5CF6'),
  ('Nómina', 'Salarios y beneficios de empleados', '#10B981'),
  ('Suministros', 'Material de oficina y operativo', '#F59E0B'),
  ('Marketing', 'Publicidad y promoción', '#EF4444'),
  ('Mantenimiento', 'Reparaciones y mantenimiento', '#6366F1'),
  ('Impuestos', 'Impuestos y tasas gubernamentales', '#DC2626'),
  ('Otros', 'Gastos varios', '#6B7280')
ON CONFLICT DO NOTHING;

-- Actualizar permisos de roles para incluir el módulo de gastos
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
  ('admin', 'expenses', true, true, true, true, true),
  ('manager', 'expenses', true, true, true, false, true),
  ('accountant', 'expenses', true, true, true, false, true),
  ('cashier', 'expenses', true, true, false, false, false)
ON CONFLICT (role, module) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_export = EXCLUDED.can_export;

-- Crear tabla para operaciones masivas (logs de operaciones)
CREATE TABLE IF NOT EXISTS public.bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('update_prices', 'update_stock', 'activate_products', 'deactivate_products', 'delete_products', 'import_products', 'export_data')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('products', 'customers', 'suppliers', 'sales', 'expenses')),
  records_affected INTEGER NOT NULL DEFAULT 0,
  operation_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE public.bulk_operations ENABLE ROW LEVEL SECURITY;

-- Políticas para bulk_operations
CREATE POLICY "Users can view bulk operations based on permissions"
  ON public.bulk_operations FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'bulk_operations', 'view'));

CREATE POLICY "Users can create bulk operations based on permissions"
  ON public.bulk_operations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'bulk_operations', 'create'));

-- Trigger para audit logs
CREATE TRIGGER audit_bulk_operations
  AFTER INSERT OR UPDATE OR DELETE ON public.bulk_operations
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Actualizar permisos de roles para operaciones masivas
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
  ('admin', 'bulk_operations', true, true, false, false, false),
  ('manager', 'bulk_operations', true, true, false, false, false)
ON CONFLICT (role, module) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create;