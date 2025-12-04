-- Migration: Add Module Auditing, Limits, Trial Period, and States
-- Priority: HIGH
-- Date: 2025-12-04

-- =====================================================
-- 1. MODULE CHANGE HISTORY (Auditoría)
-- =====================================================
CREATE TABLE IF NOT EXISTS module_change_history (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('activated', 'deactivated', 'upgraded', 'downgraded', 'trial_started', 'trial_ended')),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para auditoría
CREATE INDEX idx_module_change_history_company ON module_change_history(company_id);
CREATE INDEX idx_module_change_history_module ON module_change_history(module_id);
CREATE INDEX idx_module_change_history_changed_at ON module_change_history(changed_at DESC);
CREATE INDEX idx_module_change_history_action ON module_change_history(action);

-- RLS para auditoría
ALTER TABLE module_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all module change history"
  ON module_change_history FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert module change history"
  ON module_change_history FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

-- =====================================================
-- 2. ADD LIMITS TO PLATFORM_MODULES
-- =====================================================
ALTER TABLE platform_modules 
ADD COLUMN IF NOT EXISTS limits JSONB DEFAULT '{}';

-- Ejemplo de estructura de límites:
-- {
--   "max_products": 1000,
--   "max_users": 5,
--   "max_invoices_per_month": 500,
--   "max_storage_mb": 1024,
--   "features": ["advanced_reports", "api_access", "export_excel"]
-- }

COMMENT ON COLUMN platform_modules.limits IS 
'JSON structure defining module limits: max_products, max_users, max_invoices_per_month, max_storage_mb, features array';

-- =====================================================
-- 3. ADD DEPENDENCIES TO PLATFORM_MODULES
-- =====================================================
ALTER TABLE platform_modules 
ADD COLUMN IF NOT EXISTS dependencies JSONB DEFAULT '{}';

-- Ejemplo de estructura de dependencias:
-- {
--   "required_modules": ["employees", "products"],
--   "incompatible_with": ["simple_pos"]
-- }

COMMENT ON COLUMN platform_modules.dependencies IS 
'JSON structure defining module dependencies: required_modules array, incompatible_with array';

-- =====================================================
-- 4. ADD TRIAL AND STATUS TO COMPANY_MODULES
-- =====================================================
ALTER TABLE company_modules 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
  CHECK (status IN ('active', 'suspended', 'pending_payment', 'trial', 'expired'));

ALTER TABLE company_modules 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;

ALTER TABLE company_modules 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE company_modules 
ADD COLUMN IF NOT EXISTS custom_limits JSONB DEFAULT '{}';

COMMENT ON COLUMN company_modules.status IS 
'Module status: active, suspended, pending_payment, trial, expired';

COMMENT ON COLUMN company_modules.is_trial IS 
'Whether this module is in trial period';

COMMENT ON COLUMN company_modules.trial_ends_at IS 
'When the trial period ends (NULL if not in trial)';

COMMENT ON COLUMN company_modules.custom_limits IS 
'Company-specific limits that override default module limits';

-- Índices para company_modules
CREATE INDEX IF NOT EXISTS idx_company_modules_status ON company_modules(status);
CREATE INDEX IF NOT EXISTS idx_company_modules_trial ON company_modules(is_trial, trial_ends_at);

-- =====================================================
-- 5. MODULE USAGE TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS module_usage_stats (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  usage_type VARCHAR(50) NOT NULL, -- 'products', 'invoices', 'users', 'storage'
  current_usage INTEGER DEFAULT 0,
  limit_threshold INTEGER,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, module_id, usage_type)
);

-- Índices para usage stats
CREATE INDEX idx_module_usage_stats_company ON module_usage_stats(company_id);
CREATE INDEX idx_module_usage_stats_module ON module_usage_stats(module_id);
CREATE INDEX idx_module_usage_stats_type ON module_usage_stats(usage_type);

-- RLS para usage stats
ALTER TABLE module_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all module usage stats"
  ON module_usage_stats FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage module usage stats"
  ON module_usage_stats FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- =====================================================
-- 6. MODULE USAGE ALERTS
-- =====================================================
CREATE TABLE IF NOT EXISTS module_usage_alerts (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  usage_type VARCHAR(50) NOT NULL,
  current_usage INTEGER NOT NULL,
  limit_threshold INTEGER NOT NULL,
  alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('warning', 'critical', 'exceeded')),
  alert_sent_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para alerts
CREATE INDEX idx_module_usage_alerts_company ON module_usage_alerts(company_id);
CREATE INDEX idx_module_usage_alerts_level ON module_usage_alerts(alert_level, resolved_at);
CREATE INDEX idx_module_usage_alerts_sent ON module_usage_alerts(alert_sent_at DESC);

-- RLS para alerts
ALTER TABLE module_usage_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all module usage alerts"
  ON module_usage_alerts FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage module usage alerts"
  ON module_usage_alerts FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- =====================================================
-- 7. FUNCTION: AUTO LOG MODULE CHANGES
-- =====================================================
CREATE OR REPLACE FUNCTION log_module_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO module_change_history (
      company_id, 
      module_id, 
      action, 
      changed_by,
      new_price,
      metadata
    ) VALUES (
      NEW.company_id,
      NEW.module_id,
      CASE 
        WHEN NEW.is_trial THEN 'trial_started'
        ELSE 'activated'
      END,
      auth.uid(),
      0, -- Price will be calculated separately
      jsonb_build_object(
        'status', NEW.status,
        'is_trial', NEW.is_trial,
        'trial_ends_at', NEW.trial_ends_at
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.active != NEW.active THEN
      INSERT INTO module_change_history (
        company_id,
        module_id,
        action,
        changed_by,
        metadata
      ) VALUES (
        NEW.company_id,
        NEW.module_id,
        CASE WHEN NEW.active THEN 'activated' ELSE 'deactivated' END,
        auth.uid(),
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'old_active', OLD.active,
          'new_active', NEW.active
        )
      );
    END IF;
    
    IF OLD.status != NEW.status THEN
      INSERT INTO module_change_history (
        company_id,
        module_id,
        action,
        changed_by,
        metadata
      ) VALUES (
        NEW.company_id,
        NEW.module_id,
        CASE 
          WHEN NEW.status = 'trial' THEN 'trial_started'
          WHEN OLD.status = 'trial' AND NEW.status = 'active' THEN 'upgraded'
          WHEN OLD.status = 'trial' AND NEW.status = 'expired' THEN 'trial_ended'
          ELSE 'upgraded'
        END,
        auth.uid(),
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO module_change_history (
      company_id,
      module_id,
      action,
      changed_by,
      metadata
    ) VALUES (
      OLD.company_id,
      OLD.module_id,
      'deactivated',
      auth.uid(),
      jsonb_build_object(
        'was_trial', OLD.is_trial,
        'was_active', OLD.active
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auto-logging
DROP TRIGGER IF EXISTS trigger_log_module_changes ON company_modules;
CREATE TRIGGER trigger_log_module_changes
  AFTER INSERT OR UPDATE OR DELETE ON company_modules
  FOR EACH ROW
  EXECUTE FUNCTION log_module_change();

-- =====================================================
-- 8. FUNCTION: CHECK MODULE DEPENDENCIES
-- =====================================================
CREATE OR REPLACE FUNCTION check_module_dependencies()
RETURNS TRIGGER AS $$
DECLARE
  module_deps JSONB;
  required_modules TEXT[];
  incompatible_modules TEXT[];
  missing_module TEXT;
  has_incompatible BOOLEAN;
BEGIN
  -- Get module dependencies
  SELECT dependencies INTO module_deps
  FROM platform_modules
  WHERE id = NEW.module_id;
  
  IF module_deps IS NOT NULL AND module_deps != '{}'::jsonb THEN
    -- Check required modules
    IF module_deps ? 'required_modules' THEN
      required_modules := ARRAY(SELECT jsonb_array_elements_text(module_deps->'required_modules'));
      
      FOR missing_module IN SELECT unnest(required_modules)
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM company_modules cm
          JOIN platform_modules pm ON pm.id = cm.module_id
          WHERE cm.company_id = NEW.company_id
          AND pm.code = missing_module
          AND cm.active = true
          AND cm.status = 'active'
        ) THEN
          RAISE EXCEPTION 'Cannot activate module. Required module "%" is not active.', missing_module;
        END IF;
      END LOOP;
    END IF;
    
    -- Check incompatible modules
    IF module_deps ? 'incompatible_with' THEN
      incompatible_modules := ARRAY(SELECT jsonb_array_elements_text(module_deps->'incompatible_with'));
      
      SELECT EXISTS (
        SELECT 1
        FROM company_modules cm
        JOIN platform_modules pm ON pm.id = cm.module_id
        WHERE cm.company_id = NEW.company_id
        AND pm.code = ANY(incompatible_modules)
        AND cm.active = true
      ) INTO has_incompatible;
      
      IF has_incompatible THEN
        RAISE EXCEPTION 'Cannot activate module. Incompatible module is currently active.';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar dependencias
DROP TRIGGER IF EXISTS trigger_check_module_dependencies ON company_modules;
CREATE TRIGGER trigger_check_module_dependencies
  BEFORE INSERT OR UPDATE OF active, status ON company_modules
  FOR EACH ROW
  WHEN (NEW.active = true AND NEW.status = 'active')
  EXECUTE FUNCTION check_module_dependencies();

-- =====================================================
-- 9. FUNCTION: AUTO EXPIRE TRIAL MODULES
-- =====================================================
CREATE OR REPLACE FUNCTION expire_trial_modules()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE company_modules
  SET 
    status = 'expired',
    active = false
  WHERE 
    is_trial = true
    AND trial_ends_at < NOW()
    AND status = 'trial';
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. UPDATE EXISTING DATA (Safe updates)
-- =====================================================

-- Set default limits for existing modules (examples)
UPDATE platform_modules
SET limits = jsonb_build_object(
  'max_products', 1000,
  'max_users', 5,
  'max_invoices_per_month', 500,
  'features', '["basic_reports", "export_pdf"]'::jsonb
)
WHERE code IN ('sales', 'purchases', 'products')
AND (limits IS NULL OR limits = '{}'::jsonb);

UPDATE platform_modules
SET limits = jsonb_build_object(
  'max_employees', 10,
  'features', '["basic_payroll"]'::jsonb
)
WHERE code IN ('employees', 'payroll')
AND (limits IS NULL OR limits = '{}'::jsonb);

-- Set dependencies for modules that require others
UPDATE platform_modules
SET dependencies = jsonb_build_object(
  'required_modules', '["employees"]'::jsonb
)
WHERE code = 'payroll'
AND (dependencies IS NULL OR dependencies = '{}'::jsonb);

UPDATE platform_modules
SET dependencies = jsonb_build_object(
  'required_modules', '["products"]'::jsonb
)
WHERE code IN ('sales', 'purchases', 'pos')
AND (dependencies IS NULL OR dependencies = '{}'::jsonb);

-- Ensure all existing company_modules have proper status
UPDATE company_modules
SET status = CASE
  WHEN active = true THEN 'active'
  ELSE 'suspended'
END
WHERE status IS NULL;

-- =====================================================
-- 11. GRANT PERMISSIONS
-- =====================================================

-- Grant access to platform admins
GRANT ALL ON module_change_history TO authenticated;
GRANT ALL ON module_usage_stats TO authenticated;
GRANT ALL ON module_usage_alerts TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE module_change_history_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE module_usage_stats_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE module_usage_alerts_id_seq TO authenticated;

-- =====================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE module_change_history IS 
'Audit trail of all module activation/deactivation changes per company';

COMMENT ON TABLE module_usage_stats IS 
'Current usage statistics per module per company for limit tracking';

COMMENT ON TABLE module_usage_alerts IS 
'Alerts generated when companies approach or exceed module limits';

COMMENT ON FUNCTION log_module_change() IS 
'Automatically logs all changes to company_modules table for audit purposes';

COMMENT ON FUNCTION check_module_dependencies() IS 
'Validates module dependencies before activation to ensure required modules are active';

COMMENT ON FUNCTION expire_trial_modules() IS 
'Automatically expires trial modules that have passed their end date. Should be run via cron job.';
