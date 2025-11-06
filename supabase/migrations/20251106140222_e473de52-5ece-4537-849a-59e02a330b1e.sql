-- Crear tabla de depósitos/almacenes
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  manager_name TEXT,
  is_main BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de stock por depósito
CREATE TABLE IF NOT EXISTS public.warehouse_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  last_restock_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);

-- Crear tabla de transferencias entre depósitos
CREATE TABLE IF NOT EXISTS public.warehouse_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number TEXT NOT NULL UNIQUE,
  from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  approved_by UUID,
  received_by UUID,
  notes TEXT,
  transfer_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (from_warehouse_id != to_warehouse_id)
);

-- Crear tabla de items de transferencia
CREATE TABLE IF NOT EXISTS public.warehouse_transfer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES public.warehouse_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CHECK (quantity > 0)
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_transfer_items ENABLE ROW LEVEL SECURITY;

-- Políticas para warehouses
CREATE POLICY "Anyone authenticated can view warehouses" ON public.warehouses
  FOR SELECT USING (true);

CREATE POLICY "Admins and managers can insert warehouses" ON public.warehouses
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can update warehouses" ON public.warehouses
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Only admins can delete warehouses" ON public.warehouses
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para warehouse_stock
CREATE POLICY "Anyone authenticated can view warehouse stock" ON public.warehouse_stock
  FOR SELECT USING (true);

CREATE POLICY "Admins and managers can insert warehouse stock" ON public.warehouse_stock
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can update warehouse stock" ON public.warehouse_stock
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Only admins can delete warehouse stock" ON public.warehouse_stock
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para warehouse_transfers
CREATE POLICY "Anyone authenticated can view transfers" ON public.warehouse_transfers
  FOR SELECT USING (true);

CREATE POLICY "Anyone authenticated can create transfers" ON public.warehouse_transfers
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Admins and managers can update transfers" ON public.warehouse_transfers
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Only admins can delete transfers" ON public.warehouse_transfers
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para warehouse_transfer_items
CREATE POLICY "Anyone authenticated can view transfer items" ON public.warehouse_transfer_items
  FOR SELECT USING (true);

CREATE POLICY "Anyone authenticated can insert transfer items" ON public.warehouse_transfer_items
  FOR INSERT WITH CHECK (true);

-- Función para generar número de transferencia
CREATE OR REPLACE FUNCTION public.generate_transfer_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.warehouse_transfers;
  new_number := 'TRANS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Trigger para actualizar updated_at en warehouses
CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para actualizar updated_at en warehouse_stock
CREATE TRIGGER update_warehouse_stock_updated_at
  BEFORE UPDATE ON public.warehouse_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para actualizar updated_at en warehouse_transfers
CREATE TRIGGER update_warehouse_transfers_updated_at
  BEFORE UPDATE ON public.warehouse_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para procesar transferencias aprobadas
CREATE OR REPLACE FUNCTION public.process_warehouse_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si la transferencia se aprueba
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    NEW.approved_at := now();
    
    -- Descontar stock del depósito origen
    UPDATE warehouse_stock ws
    SET stock = ws.stock - wti.quantity
    FROM warehouse_transfer_items wti
    WHERE wti.transfer_id = NEW.id
      AND wti.product_id = ws.product_id
      AND ws.warehouse_id = NEW.from_warehouse_id;
      
    -- Agregar stock al depósito destino
    INSERT INTO warehouse_stock (warehouse_id, product_id, stock)
    SELECT NEW.to_warehouse_id, wti.product_id, wti.quantity
    FROM warehouse_transfer_items wti
    WHERE wti.transfer_id = NEW.id
    ON CONFLICT (warehouse_id, product_id) 
    DO UPDATE SET stock = warehouse_stock.stock + EXCLUDED.stock;
  END IF;
  
  -- Si la transferencia se recibe
  IF NEW.status = 'received' AND OLD.status = 'approved' THEN
    NEW.received_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para procesar transferencias
CREATE TRIGGER process_transfer_on_status_change
  BEFORE UPDATE ON public.warehouse_transfers
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.process_warehouse_transfer();

-- Crear depósito principal por defecto
INSERT INTO public.warehouses (name, code, is_main, active)
VALUES ('Depósito Principal', 'MAIN', true, true)
ON CONFLICT (code) DO NOTHING;

-- Migrar stock actual de products a warehouse_stock del depósito principal
INSERT INTO public.warehouse_stock (warehouse_id, product_id, stock, min_stock, last_restock_date)
SELECT 
  (SELECT id FROM public.warehouses WHERE is_main = true LIMIT 1),
  p.id,
  p.stock,
  p.min_stock,
  p.last_restock_date
FROM public.products p
WHERE p.active = true
ON CONFLICT (warehouse_id, product_id) DO NOTHING;

-- Agregar columna warehouse_id a sales y purchases
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);

-- Actualizar ventas y compras existentes con el depósito principal
UPDATE public.sales 
SET warehouse_id = (SELECT id FROM public.warehouses WHERE is_main = true LIMIT 1)
WHERE warehouse_id IS NULL;

UPDATE public.purchases 
SET warehouse_id = (SELECT id FROM public.warehouses WHERE is_main = true LIMIT 1)
WHERE warehouse_id IS NULL;

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON public.warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product ON public.warehouse_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transfers_from ON public.warehouse_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transfers_to ON public.warehouse_transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transfers_status ON public.warehouse_transfers(status);