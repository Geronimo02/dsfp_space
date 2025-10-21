-- Add tax and discount rate fields to sales
ALTER TABLE public.sales
ADD COLUMN discount_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN installments INTEGER DEFAULT 1,
ADD COLUMN installment_amount DECIMAL(10,2) DEFAULT 0;

-- Create company_settings table
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  tax_id TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  default_tax_rate DECIMAL(5,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  receipt_footer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_settings
CREATE POLICY "Anyone authenticated can view company settings" 
ON public.company_settings FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can insert company settings" 
ON public.company_settings FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update company settings" 
ON public.company_settings FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default company settings
INSERT INTO public.company_settings (company_name, default_tax_rate, currency)
VALUES ('Mi Empresa', 21.00, 'USD');

-- Add trigger for company_settings timestamp
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_sales_installments ON public.sales(installments);
CREATE INDEX idx_company_settings_id ON public.company_settings(id);