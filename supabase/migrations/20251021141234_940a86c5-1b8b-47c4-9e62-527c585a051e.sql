-- Create enum for service status
CREATE TYPE public.service_status AS ENUM (
  'received',
  'in_diagnosis', 
  'in_repair',
  'ready',
  'delivered'
);

-- Create technical_services table
CREATE TABLE public.technical_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id),
  device_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  reported_issue TEXT NOT NULL,
  diagnosis TEXT,
  status service_status NOT NULL DEFAULT 'received',
  received_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  estimated_completion_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  delivered_date TIMESTAMP WITH TIME ZONE,
  labor_cost NUMERIC DEFAULT 0,
  parts_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create service_parts table for tracking parts used
CREATE TABLE public.service_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.technical_services(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  part_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.technical_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_parts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for technical_services
CREATE POLICY "Anyone authenticated can view technical services"
ON public.technical_services
FOR SELECT
USING (true);

CREATE POLICY "Anyone authenticated can insert technical services"
ON public.technical_services
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can update technical services"
ON public.technical_services
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Only admins can delete technical services"
ON public.technical_services
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for service_parts
CREATE POLICY "Anyone authenticated can view service parts"
ON public.service_parts
FOR SELECT
USING (true);

CREATE POLICY "Anyone authenticated can insert service parts"
ON public.service_parts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins and managers can update service parts"
ON public.service_parts
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Only admins can delete service parts"
ON public.service_parts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_technical_services_updated_at
BEFORE UPDATE ON public.technical_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate service number
CREATE OR REPLACE FUNCTION public.generate_service_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.technical_services;
  new_number := 'SRV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;