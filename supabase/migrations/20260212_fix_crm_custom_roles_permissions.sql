-- Ensure platform admins/managers keep full CRM permissions regardless of custom roles

CREATE OR REPLACE FUNCTION public.crm_user_permissions()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN public.user_is_company_admin(public.crm_user_company_id()) THEN '{"can_view": true, "can_create": true, "can_edit": true, "can_delete": true}'::jsonb
    ELSE COALESCE(
      (
        SELECT r.permissions
        FROM public.company_users cu
        JOIN public.crm_roles r ON r.id = cu.crm_role_id
        WHERE cu.user_id = auth.uid()
        ORDER BY cu.created_at ASC
        LIMIT 1
      ),
      CASE
        WHEN public.crm_user_role() IN ('owner', 'team') THEN '{"can_view": true, "can_create": true, "can_edit": true, "can_delete": false}'::jsonb
        ELSE '{"can_view": true, "can_create": true, "can_edit": false, "can_delete": false}'::jsonb
      END
    )
  END
$$;
