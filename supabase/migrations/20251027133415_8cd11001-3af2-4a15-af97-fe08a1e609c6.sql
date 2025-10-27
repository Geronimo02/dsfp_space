-- Fix log_audit_event function to handle tables without user_id field
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
  user_name TEXT;
  changed_fields TEXT[] := '{}';
  old_json JSONB;
  new_json JSONB;
  current_user_id UUID;
  has_user_id BOOLEAN;
BEGIN
  -- Check if the table has a user_id column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = TG_TABLE_NAME 
      AND column_name = 'user_id'
  ) INTO has_user_id;

  -- Use auth.uid() if available, otherwise try to use the record's user_id if it exists
  IF has_user_id THEN
    current_user_id := COALESCE(
      auth.uid(),
      CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END
    );
  ELSE
    current_user_id := COALESCE(
      auth.uid(),
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
    );
  END IF;

  -- Only proceed if we have a valid user_id
  IF current_user_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  SELECT full_name INTO user_name FROM profiles WHERE id = current_user_id;

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
      current_user_id, user_email, user_name, TG_TABLE_NAME, OLD.id,
      TG_OP, to_jsonb(OLD), NULL, NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      user_id, user_email, user_name, table_name, record_id,
      action, old_data, new_data, changed_fields
    ) VALUES (
      current_user_id, user_email, user_name, TG_TABLE_NAME, NEW.id,
      TG_OP, old_json, new_json, changed_fields
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      user_id, user_email, user_name, table_name, record_id,
      action, old_data, new_data, changed_fields
    ) VALUES (
      current_user_id, user_email, user_name, TG_TABLE_NAME, NEW.id,
      TG_OP, NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;