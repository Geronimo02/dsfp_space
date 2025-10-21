-- Add explicit DELETE policy to company_settings table
CREATE POLICY "Only admins can delete company settings"
ON public.company_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));