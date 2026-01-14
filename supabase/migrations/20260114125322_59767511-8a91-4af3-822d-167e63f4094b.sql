-- Step 2: Drop and recreate the employee policies with proper function
DROP POLICY IF EXISTS "Employees can view their own time entries" ON public.employee_time_entries;
DROP POLICY IF EXISTS "Employees can create their own time entries" ON public.employee_time_entries;
DROP POLICY IF EXISTS "Employees can update their own time entries" ON public.employee_time_entries;

-- Recreate with the helper function
CREATE POLICY "Employees can view their own time entries" ON public.employee_time_entries
FOR SELECT USING (
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.email = public.get_current_user_email()
    AND e.active = true
  )
);

CREATE POLICY "Employees can create their own time entries" ON public.employee_time_entries
FOR INSERT WITH CHECK (
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.email = public.get_current_user_email()
    AND e.active = true
  )
);

CREATE POLICY "Employees can update their own time entries" ON public.employee_time_entries
FOR UPDATE USING (
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.email = public.get_current_user_email()
    AND e.active = true
  )
);