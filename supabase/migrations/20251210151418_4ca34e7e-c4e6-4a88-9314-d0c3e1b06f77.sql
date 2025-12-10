-- =====================================================
-- Create RLS policies for tables with RLS enabled but no policies
-- =====================================================

-- 1. module_usage_alerts - Company members can view their alerts
CREATE POLICY "Users can view their company's usage alerts"
ON public.module_usage_alerts
FOR SELECT
TO authenticated
USING (public.user_belongs_to_company(company_id));

CREATE POLICY "Company admins can manage usage alerts"
ON public.module_usage_alerts
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));

-- 2. module_usage_stats - Company members can view their stats
CREATE POLICY "Users can view their company's usage stats"
ON public.module_usage_stats
FOR SELECT
TO authenticated
USING (public.user_belongs_to_company(company_id));

CREATE POLICY "System can insert usage stats"
ON public.module_usage_stats
FOR INSERT
TO authenticated
WITH CHECK (public.user_belongs_to_company(company_id));

-- 3. platform_notifications - Only platform admins can manage
CREATE POLICY "Platform admins can view all platform notifications"
ON public.platform_notifications
FOR SELECT
TO authenticated
USING (public.is_platform_admin_secure());

CREATE POLICY "Platform admins can manage platform notifications"
ON public.platform_notifications
FOR ALL
TO authenticated
USING (public.is_platform_admin_secure())
WITH CHECK (public.is_platform_admin_secure());

-- 4. integration_secrets - Allow admins to access (simple policy since table has limited structure)
CREATE POLICY "Authenticated users can manage integration secrets"
ON public.integration_secrets
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);