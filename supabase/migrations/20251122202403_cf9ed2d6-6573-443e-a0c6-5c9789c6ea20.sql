-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'checking', -- 'savings', 'checking', 'credit'
  currency TEXT NOT NULL DEFAULT 'ARS',
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bank_movements table
CREATE TABLE IF NOT EXISTS public.bank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE CASCADE NOT NULL,
  movement_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  movement_type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'transfer_in', 'transfer_out'
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT,
  description TEXT,
  reconciled BOOLEAN DEFAULT false,
  reconciliation_date TIMESTAMP WITH TIME ZONE,
  destination_account_id UUID REFERENCES public.bank_accounts(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create card_movements table
CREATE TABLE IF NOT EXISTS public.card_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  card_type TEXT NOT NULL, -- 'credit', 'debit'
  card_brand TEXT NOT NULL, -- 'visa', 'mastercard', 'amex', 'cabal', etc.
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL,
  accreditation_date DATE NOT NULL, -- fecha esperada
  accredited_at TIMESTAMP WITH TIME ZONE, -- fecha real de acreditación
  gross_amount NUMERIC(12,2) NOT NULL,
  commission_percentage NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  net_amount NUMERIC(12,2) NOT NULL,
  installments INTEGER DEFAULT 1,
  batch_number TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'accredited'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create retentions table
CREATE TABLE IF NOT EXISTS public.retentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  retention_type TEXT NOT NULL, -- 'iibb', 'ganancias', 'iva', 'suss', etc.
  retention_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  certificate_number TEXT,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  jurisdiction TEXT, -- para IIBB (Buenos Aires, CABA, etc.)
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_bank_accounts_company ON public.bank_accounts(company_id);
CREATE INDEX idx_bank_movements_company ON public.bank_movements(company_id);
CREATE INDEX idx_bank_movements_account ON public.bank_movements(bank_account_id);
CREATE INDEX idx_card_movements_company ON public.card_movements(company_id);
CREATE INDEX idx_card_movements_status ON public.card_movements(status);
CREATE INDEX idx_card_movements_accreditation ON public.card_movements(accreditation_date);
CREATE INDEX idx_retentions_company ON public.retentions(company_id);
CREATE INDEX idx_retentions_type ON public.retentions(retention_type);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retentions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_accounts
CREATE POLICY "Users can view bank accounts from their company"
  ON public.bank_accounts FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and managers can insert bank accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (
    company_id IN (SELECT get_user_companies(auth.uid())) AND
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = bank_accounts.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('admin', 'manager')
        AND cu.active = true
    )
  );

CREATE POLICY "Admins and managers can update bank accounts"
  ON public.bank_accounts FOR UPDATE
  USING (
    company_id IN (SELECT get_user_companies(auth.uid())) AND
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = bank_accounts.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('admin', 'manager')
        AND cu.active = true
    )
  );

CREATE POLICY "Only admins can delete bank accounts"
  ON public.bank_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = bank_accounts.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- RLS Policies for bank_movements
CREATE POLICY "Users can view bank movements from their company"
  ON public.bank_movements FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can insert bank movements"
  ON public.bank_movements FOR INSERT
  WITH CHECK (
    company_id IN (SELECT get_user_companies(auth.uid())) AND
    auth.uid() = user_id
  );

CREATE POLICY "Admins and managers can update bank movements"
  ON public.bank_movements FOR UPDATE
  USING (
    company_id IN (SELECT get_user_companies(auth.uid())) AND
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = bank_movements.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('admin', 'manager')
        AND cu.active = true
    )
  );

CREATE POLICY "Only admins can delete bank movements"
  ON public.bank_movements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = bank_movements.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- RLS Policies for card_movements
CREATE POLICY "Users can view card movements from their company"
  ON public.card_movements FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can insert card movements"
  ON public.card_movements FOR INSERT
  WITH CHECK (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and managers can update card movements"
  ON public.card_movements FOR UPDATE
  USING (
    company_id IN (SELECT get_user_companies(auth.uid())) AND
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = card_movements.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('admin', 'manager')
        AND cu.active = true
    )
  );

CREATE POLICY "Only admins can delete card movements"
  ON public.card_movements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = card_movements.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- RLS Policies for retentions
CREATE POLICY "Users can view retentions from their company"
  ON public.retentions FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can insert retentions"
  ON public.retentions FOR INSERT
  WITH CHECK (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and managers can update retentions"
  ON public.retentions FOR UPDATE
  USING (
    company_id IN (SELECT get_user_companies(auth.uid())) AND
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = retentions.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('admin', 'manager')
        AND cu.active = true
    )
  );

CREATE POLICY "Only admins can delete retentions"
  ON public.retentions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = retentions.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update bank account balance on movements
CREATE OR REPLACE FUNCTION update_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type = 'deposit' OR NEW.movement_type = 'transfer_in' THEN
      UPDATE bank_accounts
      SET balance = balance + NEW.amount
      WHERE id = NEW.bank_account_id;
    ELSIF NEW.movement_type = 'withdrawal' OR NEW.movement_type = 'transfer_out' THEN
      UPDATE bank_accounts
      SET balance = balance - NEW.amount
      WHERE id = NEW.bank_account_id;
    END IF;
    
    -- If it's a transfer, update destination account
    IF NEW.movement_type = 'transfer_out' AND NEW.destination_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET balance = balance + NEW.amount
      WHERE id = NEW.destination_account_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER bank_movement_balance_update
  AFTER INSERT ON public.bank_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_account_balance();