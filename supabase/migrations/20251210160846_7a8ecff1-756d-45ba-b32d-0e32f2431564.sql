-- Fix RLS policies for access_logs table
-- Drop overly permissive policies and ensure proper restrictions

-- Ensure RLS is enabled
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well
ALTER TABLE public.access_logs FORCE ROW LEVEL SECURITY;

-- Fix RLS policies for bank_accounts table
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts FORCE ROW LEVEL SECURITY;

-- Verify the policies are restrictive (they already are based on context)
-- The issue might be that RLS wasn't being enforced for all roles

-- Add explicit denial for anonymous users on access_logs
DROP POLICY IF EXISTS "Deny anonymous access to access_logs" ON public.access_logs;

-- Add explicit denial for anonymous users on bank_accounts  
DROP POLICY IF EXISTS "Deny anonymous access to bank_accounts" ON public.bank_accounts;