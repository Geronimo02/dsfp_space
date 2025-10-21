-- Create cash_registers table for cash register sessions
CREATE TABLE public.cash_registers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opening_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closing_date TIMESTAMP WITH TIME ZONE,
  opening_amount NUMERIC NOT NULL DEFAULT 0,
  closing_amount NUMERIC,
  expected_amount NUMERIC,
  difference NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cash_movements table for cash transactions
CREATE TABLE public.cash_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'withdrawal', 'deposit')),
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cash_registers
CREATE POLICY "Anyone authenticated can view cash registers"
ON public.cash_registers
FOR SELECT
USING (true);

CREATE POLICY "Anyone authenticated can insert cash registers"
ON public.cash_registers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can update cash registers"
ON public.cash_registers
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Only admins can delete cash registers"
ON public.cash_registers
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for cash_movements
CREATE POLICY "Anyone authenticated can view cash movements"
ON public.cash_movements
FOR SELECT
USING (true);

CREATE POLICY "Anyone authenticated can insert cash movements"
ON public.cash_movements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can update cash movements"
ON public.cash_movements
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Only admins can delete cash movements"
ON public.cash_movements
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_cash_registers_updated_at
BEFORE UPDATE ON public.cash_registers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_cash_registers_user_id ON public.cash_registers(user_id);
CREATE INDEX idx_cash_registers_status ON public.cash_registers(status);
CREATE INDEX idx_cash_movements_cash_register_id ON public.cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_type ON public.cash_movements(type);