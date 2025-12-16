
-- Fix the check_module_dependencies function to avoid set-returning functions in UPDATE context
CREATE OR REPLACE FUNCTION public.check_module_dependencies()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  module_deps JSONB;
  required_module TEXT;
  incompatible_module TEXT;
  required_arr JSONB;
  incompatible_arr JSONB;
  i INTEGER;
BEGIN
  -- Get module dependencies
  SELECT dependencies INTO module_deps
  FROM platform_modules
  WHERE id = NEW.module_id;
  
  IF module_deps IS NOT NULL AND module_deps != '{}'::jsonb THEN
    -- Check required modules using array indexing instead of set-returning functions
    IF module_deps ? 'required_modules' THEN
      required_arr := module_deps->'required_modules';
      
      FOR i IN 0..jsonb_array_length(required_arr) - 1
      LOOP
        required_module := required_arr->>i;
        
        IF NOT EXISTS (
          SELECT 1
          FROM company_modules cm
          JOIN platform_modules pm ON pm.id = cm.module_id
          WHERE cm.company_id = NEW.company_id
          AND pm.code = required_module
          AND cm.active = true
          AND cm.status = 'active'
        ) THEN
          RAISE EXCEPTION 'Cannot activate module. Required module "%" is not active.', required_module;
        END IF;
      END LOOP;
    END IF;
    
    -- Check incompatible modules using array indexing
    IF module_deps ? 'incompatible_with' THEN
      incompatible_arr := module_deps->'incompatible_with';
      
      FOR i IN 0..jsonb_array_length(incompatible_arr) - 1
      LOOP
        incompatible_module := incompatible_arr->>i;
        
        IF EXISTS (
          SELECT 1
          FROM company_modules cm
          JOIN platform_modules pm ON pm.id = cm.module_id
          WHERE cm.company_id = NEW.company_id
          AND pm.code = incompatible_module
          AND cm.active = true
        ) THEN
          RAISE EXCEPTION 'Cannot activate module. Incompatible module "%" is currently active.', incompatible_module;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
