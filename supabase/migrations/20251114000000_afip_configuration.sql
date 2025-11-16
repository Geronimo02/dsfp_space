-- =============================================
-- CONFIGURACIÓN AFIP Y FISCAL
-- Agrega soporte para puntos de venta AFIP y configuración fiscal completa
-- =============================================

-- 1. AGREGAR CAMPOS FISCALES A COMPANIES
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS nombre_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS condicion_iva TEXT DEFAULT 'responsable_inscripto',
  ADD COLUMN IF NOT EXISTS inicio_actividades DATE,
  ADD COLUMN IF NOT EXISTS certificado_afip_url TEXT,
  ADD COLUMN IF NOT EXISTS clave_fiscal TEXT, -- Encriptada
  ADD COLUMN IF NOT EXISTS max_discount_percentage NUMERIC DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_installments INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS installment_surcharge JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS require_customer_document BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoprint_receipt BOOLEAN DEFAULT false;

-- Comentarios para documentación
COMMENT ON COLUMN public.companies.razon_social IS 'Razón social legal de la empresa (para facturación oficial)';
COMMENT ON COLUMN public.companies.nombre_fantasia IS 'Nombre comercial o fantasía';
COMMENT ON COLUMN public.companies.condicion_iva IS 'responsable_inscripto, monotributista, exento, consumidor_final';
COMMENT ON COLUMN public.companies.inicio_actividades IS 'Fecha de inicio de actividades ante AFIP';
COMMENT ON COLUMN public.companies.certificado_afip_url IS 'URL del certificado digital AFIP para facturación electrónica';
COMMENT ON COLUMN public.companies.max_discount_percentage IS 'Porcentaje máximo de descuento permitido en ventas';
COMMENT ON COLUMN public.companies.max_installments IS 'Cantidad máxima de cuotas permitidas';
COMMENT ON COLUMN public.companies.installment_surcharge IS 'JSON con recargos por cuota: {"3": 10, "6": 15, "12": 20}';

-- 2. CREAR TABLA DE PUNTOS DE VENTA AFIP
CREATE TABLE IF NOT EXISTS public.pos_afip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  punto_venta INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  tipo_comprobante TEXT NOT NULL DEFAULT 'FACTURA_B',
  ultimo_numero INTEGER DEFAULT 0,
  prefijo TEXT,
  ubicacion TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, punto_venta),
  CHECK (punto_venta > 0 AND punto_venta < 10000)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pos_afip_company ON public.pos_afip(company_id);
CREATE INDEX IF NOT EXISTS idx_pos_afip_active ON public.pos_afip(company_id, active) WHERE active = true;

-- Comentarios
COMMENT ON TABLE public.pos_afip IS 'Puntos de venta AFIP para facturación electrónica';
COMMENT ON COLUMN public.pos_afip.punto_venta IS 'Número de punto de venta (1-9999)';
COMMENT ON COLUMN public.pos_afip.tipo_comprobante IS 'FACTURA_A, FACTURA_B, FACTURA_C, FACTURA_E, NOTA_CREDITO, etc.';
COMMENT ON COLUMN public.pos_afip.ultimo_numero IS 'Último número de comprobante emitido';
COMMENT ON COLUMN public.pos_afip.prefijo IS 'Prefijo opcional (ej: 0001 para 0001-00001234)';

-- 3. CREAR TABLA DE COMPROBANTES AFIP (para trackear CAE)
CREATE TABLE IF NOT EXISTS public.comprobantes_afip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pos_afip_id UUID NOT NULL REFERENCES public.pos_afip(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  tipo_comprobante TEXT NOT NULL,
  punto_venta INTEGER NOT NULL,
  numero_comprobante BIGINT NOT NULL,
  numero_completo TEXT NOT NULL, -- Formato: 0001-00001234
  cae TEXT, -- Código de Autorización Electrónico
  fecha_vencimiento_cae DATE,
  fecha_emision TIMESTAMP WITH TIME ZONE DEFAULT now(),
  importe_total NUMERIC(12,2) NOT NULL,
  estado TEXT DEFAULT 'pendiente', -- pendiente, aprobado, rechazado, anulado
  observaciones TEXT,
  response_afip JSONB, -- Respuesta completa de AFIP
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, tipo_comprobante, punto_venta, numero_comprobante)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comprobantes_company ON public.comprobantes_afip(company_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_sale ON public.comprobantes_afip(sale_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_cae ON public.comprobantes_afip(cae);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON public.comprobantes_afip(estado);

-- Comentarios
COMMENT ON TABLE public.comprobantes_afip IS 'Registro de todos los comprobantes electrónicos emitidos con AFIP';
COMMENT ON COLUMN public.comprobantes_afip.cae IS 'Código de Autorización Electrónico otorgado por AFIP';
COMMENT ON COLUMN public.comprobantes_afip.numero_completo IS 'Formato completo: PPPP-NNNNNNNN';

-- 4. AGREGAR CAMPOS A SALES PARA AFIP
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS pos_afip_id UUID REFERENCES public.pos_afip(id),
  ADD COLUMN IF NOT EXISTS tipo_comprobante TEXT DEFAULT 'TICKET',
  ADD COLUMN IF NOT EXISTS numero_comprobante TEXT,
  ADD COLUMN IF NOT EXISTS cae TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_cae DATE,
  ADD COLUMN IF NOT EXISTS condicion_iva_cliente TEXT DEFAULT 'consumidor_final';

-- Comentarios para sales
COMMENT ON COLUMN public.sales.tipo_comprobante IS 'TICKET, FACTURA_A, FACTURA_B, FACTURA_C, NOTA_CREDITO';
COMMENT ON COLUMN public.sales.numero_comprobante IS 'Número completo del comprobante (ej: 0001-00001234)';
COMMENT ON COLUMN public.sales.condicion_iva_cliente IS 'Condición IVA del cliente para determinar tipo de factura';

-- 5. AGREGAR CONDICIÓN IVA A CUSTOMERS
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS condicion_iva TEXT DEFAULT 'consumidor_final',
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'DNI',
  ADD COLUMN IF NOT EXISTS numero_documento TEXT;

-- Comentarios para customers
COMMENT ON COLUMN public.customers.condicion_iva IS 'responsable_inscripto, monotributista, exento, consumidor_final';
COMMENT ON COLUMN public.customers.tipo_documento IS 'DNI, CUIT, CUIL, Pasaporte, etc.';

-- 6. FUNCIÓN PARA OBTENER SIGUIENTE NÚMERO DE COMPROBANTE
CREATE OR REPLACE FUNCTION get_next_comprobante_number(
  _pos_afip_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Incrementar y obtener el siguiente número
  UPDATE pos_afip 
  SET ultimo_numero = ultimo_numero + 1,
      updated_at = now()
  WHERE id = _pos_afip_id
  RETURNING ultimo_numero INTO next_number;
  
  RETURN next_number;
END;
$$;

-- 7. FUNCIÓN PARA FORMATEAR NÚMERO DE COMPROBANTE
CREATE OR REPLACE FUNCTION format_comprobante_number(
  _punto_venta INTEGER,
  _numero INTEGER
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LPAD(_punto_venta::TEXT, 4, '0') || '-' || LPAD(_numero::TEXT, 8, '0');
$$;

-- 8. TRIGGER PARA ACTUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_pos_afip_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe antes de crearlo
DROP TRIGGER IF EXISTS pos_afip_updated_at ON pos_afip;

CREATE TRIGGER pos_afip_updated_at
  BEFORE UPDATE ON pos_afip
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_afip_timestamp();

-- 9. RLS POLICIES

-- pos_afip
ALTER TABLE public.pos_afip ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view POS AFIP of their company" ON public.pos_afip;
DROP POLICY IF EXISTS "Admins and managers can manage POS AFIP" ON public.pos_afip;

CREATE POLICY "Users can view POS AFIP of their company"
  ON public.pos_afip FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = pos_afip.company_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
    )
  );

CREATE POLICY "Admins and managers can manage POS AFIP"
  ON public.pos_afip FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = pos_afip.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'manager')
      AND cu.active = true
    )
  );

-- comprobantes_afip
ALTER TABLE public.comprobantes_afip ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view comprobantes of their company" ON public.comprobantes_afip;
DROP POLICY IF EXISTS "Users can insert comprobantes" ON public.comprobantes_afip;

CREATE POLICY "Users can view comprobantes of their company"
  ON public.comprobantes_afip FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = comprobantes_afip.company_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
    )
  );

CREATE POLICY "Users can insert comprobantes"
  ON public.comprobantes_afip FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = comprobantes_afip.company_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
    )
  );

-- 10. PERMISOS PARA EL NUEVO MÓDULO
-- Insertar permisos para cada empresa existente
DO $$
DECLARE
  company_record RECORD;
BEGIN
  -- Iterar sobre todas las empresas
  FOR company_record IN SELECT id FROM public.companies LOOP
    -- Admin
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions 
      WHERE role = 'admin' AND module = 'pos_afip' AND company_id = company_record.id
    ) THEN
      INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
      VALUES (company_record.id, 'admin', 'pos_afip', true, true, true, true, true);
    END IF;

    -- Manager
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions 
      WHERE role = 'manager' AND module = 'pos_afip' AND company_id = company_record.id
    ) THEN
      INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
      VALUES (company_record.id, 'manager', 'pos_afip', true, true, true, false, true);
    END IF;

    -- Accountant
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions 
      WHERE role = 'accountant' AND module = 'pos_afip' AND company_id = company_record.id
    ) THEN
      INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
      VALUES (company_record.id, 'accountant', 'pos_afip', true, false, false, false, true);
    END IF;

    -- Cashier
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions 
      WHERE role = 'cashier' AND module = 'pos_afip' AND company_id = company_record.id
    ) THEN
      INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
      VALUES (company_record.id, 'cashier', 'pos_afip', true, false, false, false, false);
    END IF;

    -- Employee
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions 
      WHERE role = 'employee' AND module = 'pos_afip' AND company_id = company_record.id
    ) THEN
      INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
      VALUES (company_record.id, 'employee', 'pos_afip', true, false, false, false, false);
    END IF;

    -- Warehouse
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions 
      WHERE role = 'warehouse' AND module = 'pos_afip' AND company_id = company_record.id
    ) THEN
      INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
      VALUES (company_record.id, 'warehouse', 'pos_afip', true, false, false, false, false);
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Permisos pos_afip creados para todas las empresas existentes';
END $$;

-- 11. TRIGGER PARA AUTO-CREAR PERMISOS AL CREAR NUEVA EMPRESA
CREATE OR REPLACE FUNCTION create_pos_afip_permissions_for_new_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Insertar permisos para el módulo pos_afip para la nueva empresa
  INSERT INTO public.role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete, can_export)
  VALUES 
    (NEW.id, 'admin', 'pos_afip', true, true, true, true, true),
    (NEW.id, 'manager', 'pos_afip', true, true, true, false, true),
    (NEW.id, 'accountant', 'pos_afip', true, false, false, false, true),
    (NEW.id, 'cashier', 'pos_afip', true, false, false, false, false),
    (NEW.id, 'employee', 'pos_afip', true, false, false, false, false),
    (NEW.id, 'warehouse', 'pos_afip', true, false, false, false, false);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_create_pos_afip_permissions ON public.companies;

-- Crear trigger
CREATE TRIGGER trigger_create_pos_afip_permissions
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION create_pos_afip_permissions_for_new_company();

-- 12. DATOS DE EJEMPLO (opcional, comentado por defecto)
-- Descomentar si quieres datos de prueba
/*
INSERT INTO public.pos_afip (company_id, punto_venta, descripcion, tipo_comprobante)
SELECT 
  id,
  1,
  'Punto de Venta Principal',
  'FACTURA_B'
FROM public.companies
LIMIT 1;
*/
