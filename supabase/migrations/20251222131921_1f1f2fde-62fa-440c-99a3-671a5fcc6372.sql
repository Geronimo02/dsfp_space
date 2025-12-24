-- Add specific contribution rate columns to payroll_contribution_rates
ALTER TABLE public.payroll_contribution_rates
ADD COLUMN IF NOT EXISTS jubilacion_empleado DECIMAL(5,2) DEFAULT 11,
ADD COLUMN IF NOT EXISTS obra_social_empleado DECIMAL(5,2) DEFAULT 3,
ADD COLUMN IF NOT EXISTS pami_empleado DECIMAL(5,2) DEFAULT 3,
ADD COLUMN IF NOT EXISTS sindicato_empleado DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jubilacion_empleador DECIMAL(5,2) DEFAULT 10.17,
ADD COLUMN IF NOT EXISTS obra_social_empleador DECIMAL(5,2) DEFAULT 6,
ADD COLUMN IF NOT EXISTS pami_empleador DECIMAL(5,2) DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS art_empleador DECIMAL(5,2) DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS seguro_vida_empleador DECIMAL(5,2) DEFAULT 0.03;