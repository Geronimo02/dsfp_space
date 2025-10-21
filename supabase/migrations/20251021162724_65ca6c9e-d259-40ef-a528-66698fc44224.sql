-- Fix supplier data exposure by restricting SELECT access to admin/manager roles only
DROP POLICY IF EXISTS "Anyone authenticated can view suppliers" ON suppliers;

CREATE POLICY "Only admins and managers can view suppliers" 
ON suppliers FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));