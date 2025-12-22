-- Fix security definer view issue by using SECURITY INVOKER (default)
DROP VIEW IF EXISTS public.company_member_profiles;

-- Recreate view without SECURITY DEFINER (uses SECURITY INVOKER by default)
-- This view will respect RLS of the querying user
CREATE VIEW public.company_member_profiles 
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  cu.company_id
FROM profiles p
INNER JOIN company_users cu ON cu.user_id = p.id AND cu.active = true;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.company_member_profiles TO authenticated;

-- Add RLS policy for profiles to allow viewing basic info of company members
-- This works alongside the existing "Users can view their own profile" policy
CREATE POLICY "Users can view basic info of company members"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM company_users cu1
    INNER JOIN company_users cu2 ON cu1.company_id = cu2.company_id
    WHERE cu1.user_id = auth.uid() 
      AND cu2.user_id = profiles.id
      AND cu1.active = true 
      AND cu2.active = true
  )
);