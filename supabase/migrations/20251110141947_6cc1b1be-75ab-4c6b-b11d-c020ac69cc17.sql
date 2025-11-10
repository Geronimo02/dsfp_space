-- Drop old RLS policies and create new ones with company_id filtering

-- Products policies
DROP POLICY IF EXISTS "Admins and managers can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins and managers can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Anyone authenticated can view products" ON public.products;

CREATE POLICY "Users can view products from their company"
  ON public.products FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Admins and managers can insert products in their company"
  ON public.products FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update products in their company"
  ON public.products FOR UPDATE
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete products from their company"
  ON public.products FOR DELETE
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role = 'admin'
    )
  );

-- Customers policies
DROP POLICY IF EXISTS "Admins and managers can update customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone authenticated can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Cashiers can view customers for POS" ON public.customers;
DROP POLICY IF EXISTS "Only admins and managers can view customers" ON public.customers;

CREATE POLICY "Users can view customers from their company"
  ON public.customers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can insert customers in their company"
  ON public.customers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Admins and managers can update customers in their company"
  ON public.customers FOR UPDATE
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role IN ('admin', 'manager')
    )
  );

-- Sales policies
DROP POLICY IF EXISTS "Admins and managers can update sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone authenticated can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone authenticated can view sales" ON public.sales;
DROP POLICY IF EXISTS "Only admins can delete sales" ON public.sales;

CREATE POLICY "Users can view sales from their company"
  ON public.sales FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can insert sales in their company"
  ON public.sales FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Admins and managers can update sales in their company"
  ON public.sales FOR UPDATE
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete sales from their company"
  ON public.sales FOR DELETE
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role = 'admin'
    )
  );

-- Quotations policies
DROP POLICY IF EXISTS "Admins and managers can update quotations" ON public.quotations;
DROP POLICY IF EXISTS "Admins, managers and accountants can create quotations" ON public.quotations;
DROP POLICY IF EXISTS "Anyone authenticated can view quotations" ON public.quotations;
DROP POLICY IF EXISTS "Only admins can delete quotations" ON public.quotations;

CREATE POLICY "Users can view quotations from their company"
  ON public.quotations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can insert quotations in their company"
  ON public.quotations FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role IN ('admin', 'manager', 'accountant')
    )
  );

CREATE POLICY "Admins and managers can update quotations in their company"
  ON public.quotations FOR UPDATE
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete quotations from their company"
  ON public.quotations FOR DELETE
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() 
        AND cu.active = true
        AND cu.role = 'admin'
    )
  );