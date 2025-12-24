-- Fix RLS policies for platform_support_tickets
-- Allow platform admins to UPDATE tickets
CREATE POLICY "admin_can_update_all_tickets" ON platform_support_tickets
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.user_id = auth.uid() AND pa.active = true
  )
);

-- Allow platform admins to DELETE tickets
CREATE POLICY "admin_can_delete_all_tickets" ON platform_support_tickets
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.user_id = auth.uid() AND pa.active = true
  )
);

-- Also allow platform admins to INSERT on behalf of companies (for test data)
CREATE POLICY "admin_can_insert_tickets" ON platform_support_tickets
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.user_id = auth.uid() AND pa.active = true
  )
);