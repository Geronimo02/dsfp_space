-- =====================================================
-- CRITICAL FIX: Enable RLS on tables that have policies but RLS disabled
-- =====================================================

-- 1. Enable RLS on companies table (has 4 policies defined but RLS was disabled)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on company_users table (has 9 policies defined but RLS was disabled)
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- 3. Enable RLS on company_subscriptions table (has 4 policies defined but RLS was disabled)
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;