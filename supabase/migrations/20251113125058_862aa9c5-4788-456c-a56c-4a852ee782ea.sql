-- Drop existing problematic policy
DROP POLICY IF EXISTS "Company admins can manage company users" ON public.company_users;

-- Create new policy using security definer function to avoid recursion
CREATE POLICY "Company admins can manage company users"
ON public.company_users
FOR ALL
USING (
  -- Users can view/manage users in companies where they are admins
  EXISTS (
    SELECT 1 
    FROM public.companies c
    WHERE c.id = company_users.company_id
      AND public.has_role_in_company(auth.uid(), c.id, 'admin'::app_role)
  )
);