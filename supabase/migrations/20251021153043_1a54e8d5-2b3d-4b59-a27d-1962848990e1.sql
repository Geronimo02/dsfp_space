-- Update the handle_new_user function to also assign default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  
  -- Assign default 'employee' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'employee'::app_role);
  
  RETURN new;
END;
$$;