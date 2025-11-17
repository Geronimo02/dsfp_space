-- Fix all *_items and *_payments tables to work with multi-company setup
-- Add company_id and RLS policies to all relationship tables

-- =====================================================
-- PURCHASE ITEMS
-- =====================================================
ALTER TABLE public.purchase_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.purchase_items pi
SET company_id = p.company_id
FROM public.purchases p
WHERE pi.purchase_id = p.id AND pi.company_id IS NULL;

ALTER TABLE public.purchase_items ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_items_company ON public.purchase_items(company_id);

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view purchase items from their company" ON public.purchase_items;
CREATE POLICY "Users can view purchase items from their company"
  ON public.purchase_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert purchase items for their company" ON public.purchase_items;
CREATE POLICY "Users can insert purchase items for their company"
  ON public.purchase_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- =====================================================
-- QUOTATION ITEMS
-- =====================================================
ALTER TABLE public.quotation_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.quotation_items qi
SET company_id = q.company_id
FROM public.quotations q
WHERE qi.quotation_id = q.id AND qi.company_id IS NULL;

ALTER TABLE public.quotation_items ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotation_items_company ON public.quotation_items(company_id);

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view quotation items from their company" ON public.quotation_items;
CREATE POLICY "Users can view quotation items from their company"
  ON public.quotation_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert quotation items for their company" ON public.quotation_items;
CREATE POLICY "Users can insert quotation items for their company"
  ON public.quotation_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- =====================================================
-- DELIVERY NOTE ITEMS
-- =====================================================
ALTER TABLE public.delivery_note_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.delivery_note_items dni
SET company_id = dn.company_id
FROM public.delivery_notes dn
WHERE dni.delivery_note_id = dn.id AND dni.company_id IS NULL;

ALTER TABLE public.delivery_note_items ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_company ON public.delivery_note_items(company_id);

ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view delivery note items from their company" ON public.delivery_note_items;
CREATE POLICY "Users can view delivery note items from their company"
  ON public.delivery_note_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert delivery note items for their company" ON public.delivery_note_items;
CREATE POLICY "Users can insert delivery note items for their company"
  ON public.delivery_note_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- =====================================================
-- RETURN ITEMS
-- =====================================================
ALTER TABLE public.return_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.return_items ri
SET company_id = r.company_id
FROM public.returns r
WHERE ri.return_id = r.id AND ri.company_id IS NULL;

ALTER TABLE public.return_items ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_return_items_company ON public.return_items(company_id);

ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view return items from their company" ON public.return_items;
CREATE POLICY "Users can view return items from their company"
  ON public.return_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert return items for their company" ON public.return_items;
CREATE POLICY "Users can insert return items for their company"
  ON public.return_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- =====================================================
-- RESERVATION ITEMS
-- =====================================================
ALTER TABLE public.reservation_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.reservation_items ri
SET company_id = r.company_id
FROM public.reservations r
WHERE ri.reservation_id = r.id AND ri.company_id IS NULL;

ALTER TABLE public.reservation_items ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservation_items_company ON public.reservation_items(company_id);

ALTER TABLE public.reservation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reservation items from their company" ON public.reservation_items;
CREATE POLICY "Users can view reservation items from their company"
  ON public.reservation_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert reservation items for their company" ON public.reservation_items;
CREATE POLICY "Users can insert reservation items for their company"
  ON public.reservation_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- =====================================================
-- SALE PAYMENTS
-- =====================================================
ALTER TABLE public.sale_payments 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.sale_payments sp
SET company_id = s.company_id
FROM public.sales s
WHERE sp.sale_id = s.id AND sp.company_id IS NULL;

ALTER TABLE public.sale_payments ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sale_payments_company ON public.sale_payments(company_id);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sale payments from their company" ON public.sale_payments;
CREATE POLICY "Users can view sale payments from their company"
  ON public.sale_payments FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert sale payments for their company" ON public.sale_payments;
CREATE POLICY "Users can insert sale payments for their company"
  ON public.sale_payments FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- =====================================================
-- RESERVATION PAYMENTS
-- =====================================================
ALTER TABLE public.reservation_payments 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.reservation_payments rp
SET company_id = r.company_id
FROM public.reservations r
WHERE rp.reservation_id = r.id AND rp.company_id IS NULL;

ALTER TABLE public.reservation_payments ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservation_payments_company ON public.reservation_payments(company_id);

ALTER TABLE public.reservation_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reservation payments from their company" ON public.reservation_payments;
CREATE POLICY "Users can view reservation payments from their company"
  ON public.reservation_payments FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert reservation payments for their company" ON public.reservation_payments;
CREATE POLICY "Users can insert reservation payments for their company"
  ON public.reservation_payments FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- =====================================================
-- SUPPLIER PAYMENTS
-- =====================================================
ALTER TABLE public.supplier_payments 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.supplier_payments sp
SET company_id = s.company_id
FROM public.suppliers s
WHERE sp.supplier_id = s.id AND sp.company_id IS NULL;

ALTER TABLE public.supplier_payments ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_payments_company ON public.supplier_payments(company_id);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view supplier payments from their company" ON public.supplier_payments;
CREATE POLICY "Users can view supplier payments from their company"
  ON public.supplier_payments FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert supplier payments for their company" ON public.supplier_payments;
CREATE POLICY "Users can insert supplier payments for their company"
  ON public.supplier_payments FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

-- =====================================================
-- WAREHOUSE TRANSFER ITEMS
-- =====================================================
ALTER TABLE public.warehouse_transfer_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.warehouse_transfer_items wti
SET company_id = wt.company_id
FROM public.warehouse_transfers wt
WHERE wti.transfer_id = wt.id AND wti.company_id IS NULL;

ALTER TABLE public.warehouse_transfer_items ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warehouse_transfer_items_company ON public.warehouse_transfer_items(company_id);

ALTER TABLE public.warehouse_transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view warehouse transfer items from their company" ON public.warehouse_transfer_items;
CREATE POLICY "Users can view warehouse transfer items from their company"
  ON public.warehouse_transfer_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can insert warehouse transfer items for their company" ON public.warehouse_transfer_items;
CREATE POLICY "Users can insert warehouse transfer items for their company"
  ON public.warehouse_transfer_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true));
