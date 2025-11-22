-- Create platform admins table (separate from company users)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  active BOOLEAN DEFAULT true
);

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'monthly', -- monthly, yearly
  max_users INTEGER,
  max_products INTEGER,
  features JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create company subscriptions table
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, cancelled, trial
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  next_payment_date TIMESTAMP WITH TIME ZONE,
  amount_due NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = _user_id
      AND active = true
  )
$$;

-- RLS Policies for platform_admins
CREATE POLICY "Platform admins can view themselves"
ON public.platform_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for subscription_plans
CREATE POLICY "Platform admins can manage subscription plans"
ON public.subscription_plans
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can view active subscription plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (active = true);

-- RLS Policies for company_subscriptions
CREATE POLICY "Platform admins can manage all subscriptions"
ON public.company_subscriptions
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Company admins can view their subscription"
ON public.company_subscriptions
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM company_users 
    WHERE user_id = auth.uid() 
      AND role = 'admin'
      AND active = true
  )
);

-- Update companies RLS to allow platform admins to view all
CREATE POLICY "Platform admins can view all companies"
ON public.companies
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_company_subscriptions_updated_at
BEFORE UPDATE ON public.company_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, description, price, billing_period, features) VALUES
('Free', 'Plan gratuito con funcionalidades básicas', 0, 'monthly', '{"max_users": 2, "max_products": 100, "support": "email"}'),
('Básico', 'Plan básico para pequeños negocios', 29.99, 'monthly', '{"max_users": 5, "max_products": 500, "support": "email"}'),
('Profesional', 'Plan profesional para empresas en crecimiento', 79.99, 'monthly', '{"max_users": 20, "max_products": 5000, "support": "priority"}'),
('Empresarial', 'Plan empresarial sin límites', 199.99, 'monthly', '{"max_users": -1, "max_products": -1, "support": "24/7"}');

-- Create indexes
CREATE INDEX idx_platform_admins_user_id ON public.platform_admins(user_id);
CREATE INDEX idx_company_subscriptions_company_id ON public.company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_status ON public.company_subscriptions(status);

-- Note: After creating your account with email geronimoserratti@hotmail.com in Supabase Auth,
-- run this query to add yourself as platform admin (replace YOUR_USER_ID):
-- INSERT INTO public.platform_admins (user_id, email) 
-- VALUES ('YOUR_USER_ID', 'geronimoserratti@hotmail.com');