-- =============================================
-- OPTIMIZACIÓN DE POLÍTICAS RLS - RENDIMIENTO
-- Reemplaza auth.uid() con (select auth.uid()) 
-- =============================================

-- =============================================
-- 1. PLATFORM_PRICING_CONFIG - Consolidar duplicadas
-- =============================================
DROP POLICY IF EXISTS "Platform admins can view pricing config" ON public.platform_pricing_config;
DROP POLICY IF EXISTS "Platform admins can update pricing config" ON public.platform_pricing_config;
DROP POLICY IF EXISTS "Authenticated users can view pricing config" ON public.platform_pricing_config;
DROP POLICY IF EXISTS "Only platform admins can view pricing config" ON public.platform_pricing_config;

CREATE POLICY "Platform admins can view pricing config" 
ON public.platform_pricing_config FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.platform_admin = true
  )
);

CREATE POLICY "Platform admins can update pricing config" 
ON public.platform_pricing_config FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.platform_admin = true
  )
);

-- =============================================
-- 2. PROFILES - usa 'id' como user_id
-- =============================================
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles from their company" ON public.profiles;

CREATE POLICY "Users can view own or company profiles" 
ON public.profiles FOR SELECT
USING (
  id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.company_users cu1
    JOIN public.company_users cu2 ON cu1.company_id = cu2.company_id
    WHERE cu1.user_id = (select auth.uid()) AND cu2.user_id = profiles.id
  )
);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE
USING (id = (select auth.uid()));

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT
WITH CHECK (id = (select auth.uid()));

-- =============================================
-- 3. USER_ROLES - no tiene company_id, usar user_id directo
-- =============================================
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles" 
ON public.user_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert roles" 
ON public.user_roles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.role = 'admin'
  )
);

CREATE POLICY "Admins can update roles" 
ON public.user_roles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.role = 'admin'
  )
);

CREATE POLICY "Admins can delete roles" 
ON public.user_roles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 4. PRICE_LISTS
-- =============================================
DROP POLICY IF EXISTS "Users can view their company's price lists" ON public.price_lists;
DROP POLICY IF EXISTS "Admins and managers can insert price lists for their company" ON public.price_lists;
DROP POLICY IF EXISTS "Admins and managers can update their company's price lists" ON public.price_lists;
DROP POLICY IF EXISTS "Admins can delete their company's price lists" ON public.price_lists;

CREATE POLICY "Users can view company price lists" 
ON public.price_lists FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = price_lists.company_id
  )
);

CREATE POLICY "Admins managers can insert price lists" 
ON public.price_lists FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = price_lists.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins managers can update price lists" 
ON public.price_lists FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = price_lists.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete price lists" 
ON public.price_lists FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = price_lists.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 5. SUPPLIERS
-- =============================================
DROP POLICY IF EXISTS "Only admins and managers can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins and managers can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins and managers can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can delete suppliers" ON public.suppliers;

CREATE POLICY "Admins managers can view suppliers" 
ON public.suppliers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = suppliers.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins managers can insert suppliers" 
ON public.suppliers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = suppliers.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins managers can update suppliers" 
ON public.suppliers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = suppliers.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete suppliers" 
ON public.suppliers FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = suppliers.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 6. PURCHASES
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admins and managers can update purchases" ON public.purchases;
DROP POLICY IF EXISTS "Only admins can delete purchases" ON public.purchases;

CREATE POLICY "Admins managers can insert purchases" 
ON public.purchases FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = purchases.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins managers can update purchases" 
ON public.purchases FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = purchases.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete purchases" 
ON public.purchases FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = purchases.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 7. PURCHASE_ITEMS - Consolidar duplicadas
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can insert purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Only admins can delete purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Users can insert purchase items for their company" ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone authenticated can view purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Users can view purchase items from their company" ON public.purchase_items;

CREATE POLICY "Users can view company purchase items" 
ON public.purchase_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = purchase_items.company_id
  )
);

CREATE POLICY "Admins managers can insert purchase items" 
ON public.purchase_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = purchase_items.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete purchase items" 
ON public.purchase_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = purchase_items.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 8. SUPPLIER_PAYMENTS
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can insert supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Only admins can delete supplier payments" ON public.supplier_payments;

CREATE POLICY "Admins managers can insert supplier payments" 
ON public.supplier_payments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = supplier_payments.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete supplier payments" 
ON public.supplier_payments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = supplier_payments.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 9. TECHNICAL_SERVICES
-- =============================================
DROP POLICY IF EXISTS "Anyone authenticated can insert technical services" ON public.technical_services;
DROP POLICY IF EXISTS "Admins and managers can update technical services" ON public.technical_services;
DROP POLICY IF EXISTS "Only admins can delete technical services" ON public.technical_services;

CREATE POLICY "Authenticated can insert technical services" 
ON public.technical_services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = technical_services.company_id
  )
);

CREATE POLICY "Admins managers can update technical services" 
ON public.technical_services FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = technical_services.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete technical services" 
ON public.technical_services FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = technical_services.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 10. SERVICE_PARTS - sin company_id, usar join
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can update service parts" ON public.service_parts;
DROP POLICY IF EXISTS "Only admins can delete service parts" ON public.service_parts;

CREATE POLICY "Admins managers can update service parts" 
ON public.service_parts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    JOIN public.technical_services ts ON ts.company_id = cu.company_id
    WHERE cu.user_id = (select auth.uid()) 
    AND ts.id = service_parts.service_id
    AND cu.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete service parts" 
ON public.service_parts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    JOIN public.technical_services ts ON ts.company_id = cu.company_id
    WHERE cu.user_id = (select auth.uid()) 
    AND ts.id = service_parts.service_id
    AND cu.role = 'admin'
  )
);

-- =============================================
-- 11. CASH_REGISTERS
-- =============================================
DROP POLICY IF EXISTS "Anyone authenticated can insert cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Admins and managers can update cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Only admins can delete cash registers" ON public.cash_registers;

CREATE POLICY "Authenticated can insert cash registers" 
ON public.cash_registers FOR INSERT
WITH CHECK (
  (select auth.uid()) = user_id AND
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = cash_registers.company_id
  )
);

CREATE POLICY "Admins managers can update cash registers" 
ON public.cash_registers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = cash_registers.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete cash registers" 
ON public.cash_registers FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = cash_registers.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 12. CASH_MOVEMENTS
-- =============================================
DROP POLICY IF EXISTS "Anyone authenticated can insert cash movements" ON public.cash_movements;
DROP POLICY IF EXISTS "Admins and managers can update cash movements" ON public.cash_movements;
DROP POLICY IF EXISTS "Only admins can delete cash movements" ON public.cash_movements;

CREATE POLICY "Authenticated can insert cash movements" 
ON public.cash_movements FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins managers can update cash movements" 
ON public.cash_movements FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = cash_movements.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete cash movements" 
ON public.cash_movements FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = cash_movements.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 13. CUSTOMER_PAYMENTS
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can insert customer payments" ON public.customer_payments;
DROP POLICY IF EXISTS "Only admins can delete customer payments" ON public.customer_payments;

CREATE POLICY "Admins managers can insert customer payments" 
ON public.customer_payments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_payments.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete customer payments" 
ON public.customer_payments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_payments.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 14. DELIVERY_NOTES
-- =============================================
DROP POLICY IF EXISTS "Only admins can delete delivery notes" ON public.delivery_notes;

CREATE POLICY "Admins can delete delivery notes" 
ON public.delivery_notes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = delivery_notes.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 15. INTEGRATIONS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Users can view integrations for their company" ON public.integrations;
DROP POLICY IF EXISTS "Users can update integrations for their company" ON public.integrations;
DROP POLICY IF EXISTS "Users can view integrations from their company" ON public.integrations;
DROP POLICY IF EXISTS "Admins can manage integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can insert integrations for their company" ON public.integrations;
DROP POLICY IF EXISTS "service_role_read_integrations" ON public.integrations;

CREATE POLICY "Users can view company integrations" 
ON public.integrations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = integrations.company_id
  )
);

CREATE POLICY "Admins can manage integrations" 
ON public.integrations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = integrations.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 16. AUDIT_LOGS
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view audit logs" ON public.audit_logs;

CREATE POLICY "Admins managers can view audit logs" 
ON public.audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.role IN ('admin', 'manager')
  )
);

-- =============================================
-- 17. ACCESS_LOGS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view access logs" ON public.access_logs;
DROP POLICY IF EXISTS "Users can view their own access logs" ON public.access_logs;

CREATE POLICY "Users can view access logs" 
ON public.access_logs FOR SELECT
USING (
  user_id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.role IN ('admin', 'manager')
  )
);

-- =============================================
-- 18. EMPLOYEES - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Users can view employees from their company" ON public.employees;
DROP POLICY IF EXISTS "Admins and managers can manage employees" ON public.employees;

CREATE POLICY "Users can view company employees" 
ON public.employees FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = employees.company_id
  )
);

CREATE POLICY "Admins managers can manage employees" 
ON public.employees FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = employees.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

-- =============================================
-- 19. PAYROLL_CONCEPTS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Users can view payroll concepts from their company" ON public.payroll_concepts;
DROP POLICY IF EXISTS "Admins can manage payroll concepts" ON public.payroll_concepts;

CREATE POLICY "Users can view company payroll concepts" 
ON public.payroll_concepts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = payroll_concepts.company_id
  )
);

CREATE POLICY "Admins can manage payroll concepts" 
ON public.payroll_concepts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = payroll_concepts.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 20. PAYROLL_LIQUIDATIONS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Users can view payroll liquidations from their company" ON public.payroll_liquidations;
DROP POLICY IF EXISTS "Admins and managers can manage payroll liquidations" ON public.payroll_liquidations;

CREATE POLICY "Users can view company payroll liquidations" 
ON public.payroll_liquidations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = payroll_liquidations.company_id
  )
);

CREATE POLICY "Admins managers can manage payroll liquidations" 
ON public.payroll_liquidations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = payroll_liquidations.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

-- =============================================
-- 21. PAYROLL_LIQUIDATION_ITEMS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Users can view payroll liquidation items" ON public.payroll_liquidation_items;
DROP POLICY IF EXISTS "Users can manage payroll liquidation items" ON public.payroll_liquidation_items;

CREATE POLICY "Users can view payroll liquidation items" 
ON public.payroll_liquidation_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    JOIN public.payroll_liquidations pl ON pl.company_id = cu.company_id
    WHERE cu.user_id = (select auth.uid()) 
    AND pl.id = payroll_liquidation_items.liquidation_id
  )
);

CREATE POLICY "Admins managers can manage liquidation items" 
ON public.payroll_liquidation_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    JOIN public.payroll_liquidations pl ON pl.company_id = cu.company_id
    WHERE cu.user_id = (select auth.uid()) 
    AND pl.id = payroll_liquidation_items.liquidation_id
    AND cu.role IN ('admin', 'manager')
  )
);

-- =============================================
-- 22. RETENTIONS
-- =============================================
DROP POLICY IF EXISTS "Users can view retentions from their company" ON public.retentions;
DROP POLICY IF EXISTS "Users can insert retentions" ON public.retentions;
DROP POLICY IF EXISTS "Admins and managers can update retentions" ON public.retentions;
DROP POLICY IF EXISTS "Only admins can delete retentions" ON public.retentions;

CREATE POLICY "Users can view company retentions" 
ON public.retentions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = retentions.company_id
  )
);

CREATE POLICY "Users can insert retentions" 
ON public.retentions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = retentions.company_id
  )
);

CREATE POLICY "Admins managers can update retentions" 
ON public.retentions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = retentions.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can delete retentions" 
ON public.retentions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = retentions.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 23. CARD_MOVEMENTS
-- =============================================
DROP POLICY IF EXISTS "Only admins can delete card movements" ON public.card_movements;

CREATE POLICY "Admins can delete card movements" 
ON public.card_movements FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = card_movements.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 24. INTEGRATION_ORDERS
-- =============================================
DROP POLICY IF EXISTS "Users can view integration orders from their company" ON public.integration_orders;
DROP POLICY IF EXISTS "Users can insert integration orders" ON public.integration_orders;
DROP POLICY IF EXISTS "Users can update integration orders" ON public.integration_orders;

CREATE POLICY "Users can view company integration orders" 
ON public.integration_orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = integration_orders.company_id
  )
);

CREATE POLICY "Users can insert integration orders" 
ON public.integration_orders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = integration_orders.company_id
  )
);

CREATE POLICY "Users can update integration orders" 
ON public.integration_orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = integration_orders.company_id
  )
);

-- =============================================
-- 25. INTEGRATION_LOGS
-- =============================================
DROP POLICY IF EXISTS "Users can view integration logs from their company" ON public.integration_logs;

CREATE POLICY "Users can view company integration logs" 
ON public.integration_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = integration_logs.company_id
  )
);

-- =============================================
-- 26. PAYROLL_CONTRIBUTION_RATES - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Users can view contribution rates from their company" ON public.payroll_contribution_rates;
DROP POLICY IF EXISTS "Admins can manage contribution rates" ON public.payroll_contribution_rates;

CREATE POLICY "Users can view company contribution rates" 
ON public.payroll_contribution_rates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = payroll_contribution_rates.company_id
  )
);

CREATE POLICY "Admins can manage contribution rates" 
ON public.payroll_contribution_rates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = payroll_contribution_rates.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 27. CUSTOMER_SUPPORT_TICKETS
-- =============================================
DROP POLICY IF EXISTS "Users can create tickets for their company" ON public.customer_support_tickets;
DROP POLICY IF EXISTS "Users can update tickets from their company" ON public.customer_support_tickets;

CREATE POLICY "Users can create company tickets" 
ON public.customer_support_tickets FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_support_tickets.company_id
  )
);

CREATE POLICY "Users can update company tickets" 
ON public.customer_support_tickets FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_support_tickets.company_id
  )
);

-- =============================================
-- 28. CUSTOMER_SUPPORT_INTEGRATIONS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Admins can manage their company integrations" ON public.customer_support_integrations;
DROP POLICY IF EXISTS "Users can view their company integrations" ON public.customer_support_integrations;

CREATE POLICY "Users can view company support integrations" 
ON public.customer_support_integrations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_support_integrations.company_id
  )
);

CREATE POLICY "Admins can manage support integrations" 
ON public.customer_support_integrations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_support_integrations.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 29. CUSTOMER_SUPPORT_SLA_SETTINGS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Admins can manage SLA settings" ON public.customer_support_sla_settings;
DROP POLICY IF EXISTS "Users can view SLA settings from their company" ON public.customer_support_sla_settings;

CREATE POLICY "Users can view company SLA settings" 
ON public.customer_support_sla_settings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_support_sla_settings.company_id
  )
);

CREATE POLICY "Admins can manage SLA settings" 
ON public.customer_support_sla_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_support_sla_settings.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 30. CUSTOMER_SUPPORT_TEMPLATES - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Admins can manage templates" ON public.customer_support_templates;
DROP POLICY IF EXISTS "Users can view templates from their company" ON public.customer_support_templates;

CREATE POLICY "Users can view company templates" 
ON public.customer_support_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_support_templates.company_id
  )
);

CREATE POLICY "Admins can manage templates" 
ON public.customer_support_templates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = customer_support_templates.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 31. DELIVERY_NOTE_ITEMS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Users can insert delivery note items for their company" ON public.delivery_note_items;
DROP POLICY IF EXISTS "Users can insert delivery note items in their company" ON public.delivery_note_items;

CREATE POLICY "Users can insert company delivery note items" 
ON public.delivery_note_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = delivery_note_items.company_id
  )
);

-- =============================================
-- 32. EXCHANGE_RATE_SETTINGS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Admins can manage their company's exchange rate settings" ON public.exchange_rate_settings;
DROP POLICY IF EXISTS "Users can view their company's exchange rate settings" ON public.exchange_rate_settings;

CREATE POLICY "Users can view company exchange rate settings" 
ON public.exchange_rate_settings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = exchange_rate_settings.company_id
  )
);

CREATE POLICY "Admins can manage exchange rate settings" 
ON public.exchange_rate_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = exchange_rate_settings.company_id
    AND company_users.role = 'admin'
  )
);

-- =============================================
-- 33. PLATFORM_SUPPORT_TICKETS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Companies can create tickets" ON public.platform_support_tickets;
DROP POLICY IF EXISTS "admin_can_insert_tickets" ON public.platform_support_tickets;
DROP POLICY IF EXISTS "Companies can update their tickets" ON public.platform_support_tickets;
DROP POLICY IF EXISTS "admin_can_update_all_tickets" ON public.platform_support_tickets;

CREATE POLICY "Users and admins can create tickets" 
ON public.platform_support_tickets FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users and admins can update tickets" 
ON public.platform_support_tickets FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = (select auth.uid())
  ) OR
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.platform_admin = true
  )
);

-- =============================================
-- 34. PROMOTIONS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can manage promotions" ON public.promotions;
DROP POLICY IF EXISTS "Anyone authenticated can view promotions" ON public.promotions;

CREATE POLICY "Users can view company promotions" 
ON public.promotions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = promotions.company_id
  )
);

CREATE POLICY "Admins managers can manage promotions" 
ON public.promotions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = promotions.company_id
    AND company_users.role IN ('admin', 'manager')
  )
);

-- =============================================
-- 35. RETURN_ITEMS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Anyone authenticated can create return items" ON public.return_items;
DROP POLICY IF EXISTS "Users can insert return items for their company" ON public.return_items;
DROP POLICY IF EXISTS "Anyone authenticated can view return items" ON public.return_items;
DROP POLICY IF EXISTS "Users can view return items from their company" ON public.return_items;

CREATE POLICY "Users can view company return items" 
ON public.return_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = return_items.company_id
  )
);

CREATE POLICY "Users can insert company return items" 
ON public.return_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = return_items.company_id
  )
);

-- =============================================
-- 36. ROLE_PERMISSIONS - Consolidar
-- =============================================
DROP POLICY IF EXISTS "Admins can manage their company role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can view their company role permissions" ON public.role_permissions;

CREATE POLICY "Users can view company role permissions" 
ON public.role_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = role_permissions.company_id
  )
);

CREATE POLICY "Admins can manage role permissions" 
ON public.role_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.user_id = (select auth.uid()) 
    AND company_users.company_id = role_permissions.company_id
    AND company_users.role = 'admin'
  )
);