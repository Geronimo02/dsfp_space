-- CRM Security & Observability - Roles (owner/team/manager)

-- Helper functions
CREATE OR REPLACE FUNCTION public.crm_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT company_id
  FROM public.company_users
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.crm_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT role::text
  FROM public.company_users
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.crm_is_owner_of_opportunity(opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.crm_opportunities o
    JOIN public.employees e ON e.id = o.owner_id
    WHERE o.id = opportunity_id
      AND lower(coalesce(e.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

CREATE OR REPLACE FUNCTION public.crm_can_access_opportunity(opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN public.crm_user_role() IN ('admin', 'manager') THEN true
    WHEN public.crm_user_role() = 'owner' THEN public.crm_is_owner_of_opportunity(opportunity_id)
    WHEN public.crm_user_role() = 'team' THEN true
    ELSE false
  END
$$;

-- Ensure RLS enabled
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stage_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_whatsapp_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.crm_scoring_rules') IS NOT NULL THEN
    ALTER TABLE public.crm_scoring_rules ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- CRM Opportunities policies
DROP POLICY IF EXISTS "Users can view opportunities from their company" ON public.crm_opportunities;
DROP POLICY IF EXISTS "Users can insert opportunities for their company" ON public.crm_opportunities;
DROP POLICY IF EXISTS "Users can update opportunities from their company" ON public.crm_opportunities;
DROP POLICY IF EXISTS "Users can delete opportunities from their company" ON public.crm_opportunities;

CREATE POLICY "CRM opportunities select by role"
  ON public.crm_opportunities
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(id)
  );

CREATE POLICY "CRM opportunities insert by role"
  ON public.crm_opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.crm_user_company_id()
    AND public.crm_user_role() IN ('admin', 'manager', 'team', 'owner')
  );

CREATE POLICY "CRM opportunities update by role"
  ON public.crm_opportunities
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(id)
  )
  WITH CHECK (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(id)
  );

CREATE POLICY "CRM opportunities delete by role"
  ON public.crm_opportunities
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_user_role() IN ('admin', 'manager')
  );

-- Activities policies (tie to opportunity access)
DROP POLICY IF EXISTS "Users can view CRM activities from their company" ON public.crm_activities;
DROP POLICY IF EXISTS "Users can insert CRM activities for their company" ON public.crm_activities;
DROP POLICY IF EXISTS "Users can update CRM activities from their company" ON public.crm_activities;
DROP POLICY IF EXISTS "Users can delete CRM activities from their company" ON public.crm_activities;

CREATE POLICY "CRM activities select by role"
  ON public.crm_activities
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(opportunity_id)
  );

CREATE POLICY "CRM activities insert by role"
  ON public.crm_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(opportunity_id)
  );

CREATE POLICY "CRM activities update by role"
  ON public.crm_activities
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(opportunity_id)
  )
  WITH CHECK (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(opportunity_id)
  );

CREATE POLICY "CRM activities delete by role"
  ON public.crm_activities
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_user_role() IN ('admin', 'manager')
  );

-- Activity log policies (read-only for allowed users)
DROP POLICY IF EXISTS "Users can view CRM activity logs from their company" ON public.crm_activity_log;
DROP POLICY IF EXISTS "Users can insert CRM activity logs for their company" ON public.crm_activity_log;
DROP POLICY IF EXISTS "Users can update CRM activity logs for their company" ON public.crm_activity_log;
DROP POLICY IF EXISTS "Users can delete CRM activity logs for their company" ON public.crm_activity_log;

CREATE POLICY "CRM activity logs select by role"
  ON public.crm_activity_log
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(opportunity_id)
  );

CREATE POLICY "CRM activity logs insert by system"
  ON public.crm_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.crm_user_company_id()
  );

-- Tags, saved views, stage rules, scoring rules, message templates/logs, whatsapp credentials
-- Keep company scoped but add delete restriction for admin/manager where relevant
DROP POLICY IF EXISTS "Users can view CRM tags from their company" ON public.crm_tags;
DROP POLICY IF EXISTS "Users can insert CRM tags for their company" ON public.crm_tags;
DROP POLICY IF EXISTS "Users can update CRM tags from their company" ON public.crm_tags;
DROP POLICY IF EXISTS "Users can delete CRM tags from their company" ON public.crm_tags;

CREATE POLICY "CRM tags select by role"
  ON public.crm_tags
  FOR SELECT TO authenticated
  USING (company_id = public.crm_user_company_id());

CREATE POLICY "CRM tags insert by role"
  ON public.crm_tags
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.crm_user_company_id());

CREATE POLICY "CRM tags update by role"
  ON public.crm_tags
  FOR UPDATE TO authenticated
  USING (company_id = public.crm_user_company_id())
  WITH CHECK (company_id = public.crm_user_company_id());

CREATE POLICY "CRM tags delete by admin"
  ON public.crm_tags
  FOR DELETE TO authenticated
  USING (company_id = public.crm_user_company_id() AND public.crm_user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "Users can view CRM saved views from their company" ON public.crm_saved_views;
DROP POLICY IF EXISTS "Users can insert CRM saved views for their company" ON public.crm_saved_views;
DROP POLICY IF EXISTS "Users can update CRM saved views from their company" ON public.crm_saved_views;
DROP POLICY IF EXISTS "Users can delete CRM saved views from their company" ON public.crm_saved_views;

CREATE POLICY "CRM saved views select by role"
  ON public.crm_saved_views
  FOR SELECT TO authenticated
  USING (company_id = public.crm_user_company_id());

CREATE POLICY "CRM saved views insert by role"
  ON public.crm_saved_views
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.crm_user_company_id());

CREATE POLICY "CRM saved views update by role"
  ON public.crm_saved_views
  FOR UPDATE TO authenticated
  USING (company_id = public.crm_user_company_id())
  WITH CHECK (company_id = public.crm_user_company_id());

CREATE POLICY "CRM saved views delete by role"
  ON public.crm_saved_views
  FOR DELETE TO authenticated
  USING (company_id = public.crm_user_company_id());

-- Stage rules
DROP POLICY IF EXISTS "Users can view CRM stage rules from their company" ON public.crm_stage_rules;
DROP POLICY IF EXISTS "Users can insert CRM stage rules for their company" ON public.crm_stage_rules;
DROP POLICY IF EXISTS "Users can update CRM stage rules from their company" ON public.crm_stage_rules;
DROP POLICY IF EXISTS "Users can delete CRM stage rules from their company" ON public.crm_stage_rules;

CREATE POLICY "CRM stage rules select by role"
  ON public.crm_stage_rules
  FOR SELECT TO authenticated
  USING (company_id = public.crm_user_company_id());

CREATE POLICY "CRM stage rules write by admin"
  ON public.crm_stage_rules
  FOR ALL TO authenticated
  USING (company_id = public.crm_user_company_id() AND public.crm_user_role() IN ('admin', 'manager'))
  WITH CHECK (company_id = public.crm_user_company_id() AND public.crm_user_role() IN ('admin', 'manager'));

-- Scoring rules
DO $$
BEGIN
  IF to_regclass('public.crm_scoring_rules') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view CRM scoring rules from their company" ON public.crm_scoring_rules;
    DROP POLICY IF EXISTS "Users can insert CRM scoring rules for their company" ON public.crm_scoring_rules;
    DROP POLICY IF EXISTS "Users can update CRM scoring rules from their company" ON public.crm_scoring_rules;
    DROP POLICY IF EXISTS "Users can delete CRM scoring rules from their company" ON public.crm_scoring_rules;

    CREATE POLICY "CRM scoring rules select by role"
      ON public.crm_scoring_rules
      FOR SELECT TO authenticated
      USING (company_id = public.crm_user_company_id());

    CREATE POLICY "CRM scoring rules write by admin"
      ON public.crm_scoring_rules
      FOR ALL TO authenticated
      USING (company_id = public.crm_user_company_id() AND public.crm_user_role() IN ('admin', 'manager'))
      WITH CHECK (company_id = public.crm_user_company_id() AND public.crm_user_role() IN ('admin', 'manager'));
  END IF;
END
$$;

-- Message templates
DROP POLICY IF EXISTS "Users can view CRM message templates from their company" ON public.crm_message_templates;
DROP POLICY IF EXISTS "Users can insert CRM message templates for their company" ON public.crm_message_templates;
DROP POLICY IF EXISTS "Users can update CRM message templates from their company" ON public.crm_message_templates;
DROP POLICY IF EXISTS "Users can delete CRM message templates from their company" ON public.crm_message_templates;

CREATE POLICY "CRM message templates select by role"
  ON public.crm_message_templates
  FOR SELECT TO authenticated
  USING (company_id = public.crm_user_company_id());

CREATE POLICY "CRM message templates write by role"
  ON public.crm_message_templates
  FOR ALL TO authenticated
  USING (company_id = public.crm_user_company_id())
  WITH CHECK (company_id = public.crm_user_company_id());

-- Message logs
DROP POLICY IF EXISTS "Users can view CRM message logs from their company" ON public.crm_message_logs;
DROP POLICY IF EXISTS "Users can insert CRM message logs for their company" ON public.crm_message_logs;
DROP POLICY IF EXISTS "Users can update CRM message logs from their company" ON public.crm_message_logs;
DROP POLICY IF EXISTS "Users can delete CRM message logs from their company" ON public.crm_message_logs;

CREATE POLICY "CRM message logs select by role"
  ON public.crm_message_logs
  FOR SELECT TO authenticated
  USING (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(opportunity_id)
  );

CREATE POLICY "CRM message logs insert by role"
  ON public.crm_message_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.crm_user_company_id()
    AND public.crm_can_access_opportunity(opportunity_id)
  );

-- WhatsApp credentials
DROP POLICY IF EXISTS "Users can view CRM whatsapp credentials from their company" ON public.crm_whatsapp_credentials;
DROP POLICY IF EXISTS "Users can insert CRM whatsapp credentials for their company" ON public.crm_whatsapp_credentials;
DROP POLICY IF EXISTS "Users can update CRM whatsapp credentials from their company" ON public.crm_whatsapp_credentials;
DROP POLICY IF EXISTS "Users can delete CRM whatsapp credentials from their company" ON public.crm_whatsapp_credentials;

CREATE POLICY "CRM whatsapp credentials select by admin"
  ON public.crm_whatsapp_credentials
  FOR SELECT TO authenticated
  USING (company_id = public.crm_user_company_id() AND public.crm_user_role() IN ('admin', 'manager'));

CREATE POLICY "CRM whatsapp credentials write by admin"
  ON public.crm_whatsapp_credentials
  FOR ALL TO authenticated
  USING (company_id = public.crm_user_company_id() AND public.crm_user_role() IN ('admin', 'manager'))
  WITH CHECK (company_id = public.crm_user_company_id() AND public.crm_user_role() IN ('admin', 'manager'));