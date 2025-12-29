-- =============================================
-- SECURITY FIX: Enable RLS on invite_tokens and signup_payment_methods
-- =============================================

-- Enable RLS on invite_tokens
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "Company admins can view company invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "Company admins can create invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "Company admins can update invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "Service role full access on invite_tokens" ON invite_tokens;

-- Policy: Only the invited user can view their token
CREATE POLICY "Users can view their own invite tokens"
  ON invite_tokens FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Company admins can view tokens for their company
CREATE POLICY "Company admins can view company invite tokens"
  ON invite_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = invite_tokens.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- Policy: Company admins can create tokens for their company
CREATE POLICY "Company admins can create invite tokens"
  ON invite_tokens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = invite_tokens.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- Policy: Company admins can update tokens (mark as used)
CREATE POLICY "Company admins can update invite tokens"
  ON invite_tokens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = invite_tokens.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- Policy: Service role (Edge Functions) full access
CREATE POLICY "Service role full access on invite_tokens"
  ON invite_tokens FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- Enable RLS on signup_payment_methods
-- =============================================

ALTER TABLE signup_payment_methods ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Company users can view linked payment methods" ON signup_payment_methods;
DROP POLICY IF EXISTS "Platform admins full access on signup_payment_methods" ON signup_payment_methods;
DROP POLICY IF EXISTS "Service role full access on signup_payment_methods" ON signup_payment_methods;

-- Policy: Company users can view payment methods linked to their company
CREATE POLICY "Company users can view linked payment methods"
  ON signup_payment_methods FOR SELECT
  USING (
    linked_to_company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Policy: Platform admins full access
CREATE POLICY "Platform admins full access on signup_payment_methods"
  ON signup_payment_methods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Policy: Service role access for webhooks
CREATE POLICY "Service role full access on signup_payment_methods"
  ON signup_payment_methods FOR ALL
  USING (auth.role() = 'service_role');