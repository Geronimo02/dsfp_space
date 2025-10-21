-- =============================================
-- PASO 2: TABLAS DE AUDITORÍA Y PERMISOS
-- =============================================

-- 1. TABLA DE PERMISOS POR MÓDULO
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, module)
);

-- 2. TABLA DE AUDITORÍA
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  user_name TEXT,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. TABLA DE LOGS DE ACCESO
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  page_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action);

-- 5. HABILITAR RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS RLS - ROLE_PERMISSIONS
CREATE POLICY "Admins can manage role permissions"
ON role_permissions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view role permissions"
ON role_permissions FOR SELECT
TO authenticated
USING (true);

-- 7. POLÍTICAS RLS - AUDIT_LOGS
CREATE POLICY "Admins and managers can view audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "System can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 8. POLÍTICAS RLS - ACCESS_LOGS
CREATE POLICY "Admins and managers can view access logs"
ON access_logs FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Users can view their own access logs"
ON access_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert access logs"
ON access_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 9. FUNCIÓN PARA AUDITORÍA AUTOMÁTICA
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  changed_fields TEXT[] := '{}';
  old_json JSONB;
  new_json JSONB;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  SELECT full_name INTO user_name FROM profiles WHERE id = auth.uid();

  IF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    
    SELECT array_agg(key)
    INTO changed_fields
    FROM jsonb_each(new_json)
    WHERE new_json->key IS DISTINCT FROM old_json->key;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      user_id, user_email, user_name, table_name, record_id, 
      action, old_data, new_data, changed_fields
    ) VALUES (
      auth.uid(), user_email, user_name, TG_TABLE_NAME, OLD.id,
      TG_OP, to_jsonb(OLD), NULL, NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      user_id, user_email, user_name, table_name, record_id,
      action, old_data, new_data, changed_fields
    ) VALUES (
      auth.uid(), user_email, user_name, TG_TABLE_NAME, NEW.id,
      TG_OP, old_json, new_json, changed_fields
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      user_id, user_email, user_name, table_name, record_id,
      action, old_data, new_data, changed_fields
    ) VALUES (
      auth.uid(), user_email, user_name, TG_TABLE_NAME, NEW.id,
      TG_OP, NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- 10. TRIGGERS DE AUDITORÍA
CREATE TRIGGER audit_products
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_customers
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_sales
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_purchases
AFTER INSERT OR UPDATE OR DELETE ON purchases
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_suppliers
AFTER INSERT OR UPDATE OR DELETE ON suppliers
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 11. FUNCIÓN HELPER PARA VERIFICAR PERMISOS
CREATE OR REPLACE FUNCTION has_permission(
  _user_id UUID,
  _module TEXT,
  _permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_roles app_role[];
  has_perm BOOLEAN := false;
BEGIN
  SELECT array_agg(role) INTO user_roles
  FROM user_roles
  WHERE user_id = _user_id;

  SELECT EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = ANY(user_roles)
      AND module = _module
      AND (
        (_permission = 'view' AND can_view = true) OR
        (_permission = 'create' AND can_create = true) OR
        (_permission = 'edit' AND can_edit = true) OR
        (_permission = 'delete' AND can_delete = true) OR
        (_permission = 'export' AND can_export = true)
      )
  ) INTO has_perm;

  RETURN has_perm;
END;
$$;

-- 12. TRIGGER PARA UPDATED_AT
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON role_permissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();