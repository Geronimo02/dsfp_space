-- Fix: Customer Personal Data Accessible to All Employees
-- Restrict customer data access to admin/manager roles only
DROP POLICY IF EXISTS "Anyone authenticated can view customers" ON customers;

CREATE POLICY "Only admins and managers can view customers" 
ON customers FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Fix: No User Roles Assigned - Assign admin role to existing user
INSERT INTO user_roles (user_id, role)
VALUES ('8b79eae1-7f83-4a6f-a54f-26f6d33069ec', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;