-- Update main users to admin role to allow product/supplier/customer management
UPDATE user_roles 
SET role = 'admin'::app_role
WHERE user_id IN (
  'faaeeebb-8a6a-409e-9f36-840ba42845c0', -- ferminmedina22@gmail.com
  '341b9f34-080a-4d5c-8f2d-9694d5cd9fe7'  -- digitalsolutionsfp@gmail.com
);

-- Verify the changes
SELECT ur.user_id, ur.role, au.email 
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.user_id IN (
  'faaeeebb-8a6a-409e-9f36-840ba42845c0',
  '341b9f34-080a-4d5c-8f2d-9694d5cd9fe7'
);