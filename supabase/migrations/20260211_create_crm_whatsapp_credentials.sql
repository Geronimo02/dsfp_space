-- CRM WhatsApp (Twilio) credentials per company
CREATE TABLE IF NOT EXISTS crm_whatsapp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_sid TEXT NOT NULL,
  auth_token TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

CREATE INDEX IF NOT EXISTS crm_whatsapp_credentials_company_id_idx
  ON crm_whatsapp_credentials (company_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_crm_whatsapp_credentials_updated_at ON crm_whatsapp_credentials;
CREATE TRIGGER update_crm_whatsapp_credentials_updated_at
  BEFORE UPDATE ON crm_whatsapp_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE crm_whatsapp_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view CRM WhatsApp credentials from their company"
  ON crm_whatsapp_credentials
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM WhatsApp credentials for their company"
  ON crm_whatsapp_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM WhatsApp credentials for their company"
  ON crm_whatsapp_credentials
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete CRM WhatsApp credentials for their company"
  ON crm_whatsapp_credentials
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );
