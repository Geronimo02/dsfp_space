-- Fix linter: RLS enabled but no policy on public.signup_intents
-- Keep behavior secure (no direct client access)
CREATE POLICY "No client access to signup intents"
ON public.signup_intents
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);