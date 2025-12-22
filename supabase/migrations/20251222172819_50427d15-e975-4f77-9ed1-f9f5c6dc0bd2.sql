-- Fix profiles table security: restrict access to sensitive data
-- Problem: Any company member can see WhatsApp numbers and email preferences of colleagues

-- 1. Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view own or company profiles" ON profiles;

-- 2. Create a more restrictive policy
-- Users can only view their own profile
-- For viewing other users' basic info (name, avatar), use a separate query or view
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (id = auth.uid());

-- 3. Create a secure view for basic profile info that company members can access
-- This view exposes only non-sensitive fields
CREATE OR REPLACE VIEW public.company_member_profiles AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  cu.company_id
FROM profiles p
INNER JOIN company_users cu ON cu.user_id = p.id AND cu.active = true;

-- 4. Grant access to the view for authenticated users
GRANT SELECT ON public.company_member_profiles TO authenticated;

-- 5. Create a function to get company member basic info securely
CREATE OR REPLACE FUNCTION public.get_company_members(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url
  FROM profiles p
  INNER JOIN company_users cu ON cu.user_id = p.id
  WHERE cu.company_id = p_company_id
    AND cu.active = true
    AND EXISTS (
      SELECT 1 FROM company_users cu2 
      WHERE cu2.user_id = auth.uid() 
        AND cu2.company_id = p_company_id 
        AND cu2.active = true
    );
$$;