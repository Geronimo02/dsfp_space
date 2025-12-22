-- Fix remaining SECURITY DEFINER functions without search_path

-- 19. toggle_company_module (correct signature: uuid, character varying, boolean)
ALTER FUNCTION public.toggle_company_module(uuid, character varying, boolean) 
SET search_path = public;

-- 22. user_has_company_access (correct signature: uuid, uuid)
ALTER FUNCTION public.user_has_company_access(uuid, uuid) 
SET search_path = public;