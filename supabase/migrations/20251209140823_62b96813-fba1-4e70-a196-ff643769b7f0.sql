
-- Eliminar políticas problemáticas en companies
DROP POLICY IF EXISTS "Platform admins can view all companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view their companies" ON public.companies;

-- Crear nuevas políticas seguras para companies (SELECT)
CREATE POLICY "select_companies_platform_admin"
ON public.companies
FOR SELECT
TO authenticated
USING (public.is_platform_admin_secure());

CREATE POLICY "select_companies_own"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_users.company_id = companies.id
      AND company_users.user_id = auth.uid()
      AND company_users.active = true
  )
);

-- Arreglar políticas en platform_support_messages (INSERT y SELECT usan is_platform_admin)
DROP POLICY IF EXISTS "Users can create messages in their tickets" ON public.platform_support_messages;
DROP POLICY IF EXISTS "Users can view messages of their tickets" ON public.platform_support_messages;

CREATE POLICY "select_platform_support_messages"
ON public.platform_support_messages
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin_secure()
  OR EXISTS (
    SELECT 1 FROM public.platform_support_tickets pst
    JOIN public.company_users cu ON cu.company_id = pst.company_id
    WHERE pst.id = platform_support_messages.ticket_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
  )
);

CREATE POLICY "insert_platform_support_messages"
ON public.platform_support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_platform_admin_secure()
  OR EXISTS (
    SELECT 1 FROM public.platform_support_tickets pst
    JOIN public.company_users cu ON cu.company_id = pst.company_id
    WHERE pst.id = platform_support_messages.ticket_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
  )
);

-- Arreglar políticas en platform_support_tickets
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.platform_support_tickets;
DROP POLICY IF EXISTS "Companies can view their own tickets" ON public.platform_support_tickets;

CREATE POLICY "select_platform_support_tickets_admin"
ON public.platform_support_tickets
FOR ALL
TO authenticated
USING (public.is_platform_admin_secure());

CREATE POLICY "select_platform_support_tickets_company"
ON public.platform_support_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_users.company_id = platform_support_tickets.company_id
      AND company_users.user_id = auth.uid()
      AND company_users.active = true
  )
);

CREATE POLICY "insert_platform_support_tickets_company"
ON public.platform_support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_users.company_id = platform_support_tickets.company_id
      AND company_users.user_id = auth.uid()
      AND company_users.active = true
  )
);
