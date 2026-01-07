-- Add company_id to ticket_config if missing
ALTER TABLE public.ticket_config ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create index for company_id
CREATE INDEX IF NOT EXISTS idx_ticket_config_company_id ON public.ticket_config(company_id);

-- Create employee_time_entries table for clock in/out tracking
CREATE TABLE IF NOT EXISTS public.employee_time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  clock_in timestamp with time zone NOT NULL DEFAULT now(),
  clock_out timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_time_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for employee_time_entries
-- Admins and managers can see all time entries for their company
CREATE POLICY "Admins can view all time entries"
ON public.employee_time_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = employee_time_entries.company_id
    AND cu.user_id = auth.uid()
    AND cu.role IN ('admin', 'manager')
    AND (cu.active = true OR cu.active IS NULL)
  )
);

-- Admins can insert time entries
CREATE POLICY "Admins can insert time entries"
ON public.employee_time_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = employee_time_entries.company_id
    AND cu.user_id = auth.uid()
    AND cu.role IN ('admin', 'manager')
    AND (cu.active = true OR cu.active IS NULL)
  )
);

-- Admins can update time entries
CREATE POLICY "Admins can update time entries"
ON public.employee_time_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = employee_time_entries.company_id
    AND cu.user_id = auth.uid()
    AND cu.role IN ('admin', 'manager')
    AND (cu.active = true OR cu.active IS NULL)
  )
);

-- Admins can delete time entries
CREATE POLICY "Admins can delete time entries"
ON public.employee_time_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = employee_time_entries.company_id
    AND cu.user_id = auth.uid()
    AND cu.role IN ('admin', 'manager')
    AND (cu.active = true OR cu.active IS NULL)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_time_entries_company ON public.employee_time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_time_entries_employee ON public.employee_time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_time_entries_clock_in ON public.employee_time_entries(clock_in DESC);

-- Update trigger for updated_at
CREATE TRIGGER update_employee_time_entries_updated_at
BEFORE UPDATE ON public.employee_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();