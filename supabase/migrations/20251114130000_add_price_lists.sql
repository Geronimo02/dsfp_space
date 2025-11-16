-- Migration: Add Price Lists System
-- Description: Creates tables for managing multiple price lists per product and assigns them to customers
-- Created: 2025-11-14

-- =====================================================
-- 1. CREATE PRICE_LISTS TABLE
-- =====================================================
-- Stores different pricing tiers (e.g., Retail, Wholesale, VIP)
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Constraints
    CONSTRAINT price_lists_name_not_empty CHECK (trim(name) <> ''),
    CONSTRAINT price_lists_unique_name_per_company UNIQUE (company_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_lists_company ON public.price_lists(company_id);
CREATE INDEX IF NOT EXISTS idx_price_lists_is_default ON public.price_lists(company_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_price_lists_is_active ON public.price_lists(is_active);

-- RLS Policies
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

-- Ensure idempotency: drop policies if they already exist
DROP POLICY IF EXISTS "Users can view their company's price lists" ON public.price_lists;
DROP POLICY IF EXISTS "Users can insert price lists for their company" ON public.price_lists;
DROP POLICY IF EXISTS "Users can update their company's price lists" ON public.price_lists;
DROP POLICY IF EXISTS "Users can delete their company's price lists" ON public.price_lists;

CREATE POLICY "Users can view their company's price lists"
    ON public.price_lists FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.company_id = price_lists.company_id
              AND cu.active = true
        )
    );

CREATE POLICY "Users can insert price lists for their company"
    ON public.price_lists FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.company_id = price_lists.company_id
              AND cu.active = true
        )
    );

CREATE POLICY "Users can update their company's price lists"
    ON public.price_lists FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.company_id = price_lists.company_id
              AND cu.active = true
        )
    );

CREATE POLICY "Users can delete their company's price lists"
    ON public.price_lists FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.company_id = price_lists.company_id
              AND cu.active = true
        )
    );

-- =====================================================
-- 2. CREATE PRODUCT_PRICES TABLE
-- =====================================================
-- Stores specific prices for each product in each price list
CREATE TABLE IF NOT EXISTS public.product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Constraints
    CONSTRAINT product_prices_price_positive CHECK (price >= 0),
    CONSTRAINT product_prices_unique_product_per_list UNIQUE (product_id, price_list_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_prices_product ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_price_list ON public.product_prices(price_list_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_lookup ON public.product_prices(product_id, price_list_id);

-- RLS Policies
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

-- Ensure idempotency: drop policies if they already exist
DROP POLICY IF EXISTS "Users can view product prices for their company's products" ON public.product_prices;
DROP POLICY IF EXISTS "Users can insert product prices for their company's products" ON public.product_prices;
DROP POLICY IF EXISTS "Users can update product prices for their company's products" ON public.product_prices;
DROP POLICY IF EXISTS "Users can delete product prices for their company's products" ON public.product_prices;

CREATE POLICY "Users can view product prices for their company's products"
    ON public.product_prices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.company_users cu ON cu.company_id = p.company_id
            WHERE p.id = product_prices.product_id
              AND cu.user_id = auth.uid()
              AND cu.active = true
        )
    );

CREATE POLICY "Users can insert product prices for their company's products"
    ON public.product_prices FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.company_users cu ON cu.company_id = p.company_id
            WHERE p.id = product_prices.product_id
              AND cu.user_id = auth.uid()
              AND cu.active = true
        )
    );

CREATE POLICY "Users can update product prices for their company's products"
    ON public.product_prices FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.company_users cu ON cu.company_id = p.company_id
            WHERE p.id = product_prices.product_id
              AND cu.user_id = auth.uid()
              AND cu.active = true
        )
    );

CREATE POLICY "Users can delete product prices for their company's products"
    ON public.product_prices FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.company_users cu ON cu.company_id = p.company_id
            WHERE p.id = product_prices.product_id
              AND cu.user_id = auth.uid()
              AND cu.active = true
        )
    );

-- =====================================================
-- 3. ADD PRICE_LIST_ID TO CUSTOMERS
-- =====================================================
-- Assign a default price list to each customer
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES public.price_lists(id) ON DELETE SET NULL;

-- Index for customer price list lookups
CREATE INDEX IF NOT EXISTS idx_customers_price_list ON public.customers(price_list_id);

-- =====================================================
-- 4. TRIGGER FOR UPDATED_AT
-- =====================================================
-- Update updated_at timestamp on price_lists
CREATE OR REPLACE FUNCTION update_price_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_price_lists_updated_at_trigger
    BEFORE UPDATE ON public.price_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_price_lists_updated_at();

-- Update updated_at timestamp on product_prices
CREATE OR REPLACE FUNCTION update_product_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_prices_updated_at_trigger
    BEFORE UPDATE ON public.product_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_product_prices_updated_at();

-- =====================================================
-- 5. ENSURE ONLY ONE DEFAULT PRICE LIST PER COMPANY
-- =====================================================
CREATE OR REPLACE FUNCTION ensure_single_default_price_list()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this price list as default
    IF NEW.is_default = true THEN
        -- Unset all other defaults for this company
        UPDATE public.price_lists
        SET is_default = false
        WHERE company_id = NEW.company_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_price_list_trigger
    BEFORE INSERT OR UPDATE ON public.price_lists
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_price_list();

-- =====================================================
-- 6. AUTO-CREATE DEFAULT PRICE LIST FOR EXISTING COMPANIES
-- =====================================================
DO $$
DECLARE
    company_record RECORD;
    default_list_id UUID;
BEGIN
    -- For each existing company, create a default price list
    FOR company_record IN SELECT id FROM public.companies LOOP
        -- Check if company already has a default price list
        IF NOT EXISTS (
            SELECT 1 FROM public.price_lists 
            WHERE company_id = company_record.id AND is_default = true
        ) THEN
            -- Create default price list
            INSERT INTO public.price_lists (company_id, name, description, is_default, is_active)
            VALUES (
                company_record.id,
                'Lista Minorista',
                'Lista de precios por defecto para ventas al público',
                true,
                true
            )
            RETURNING id INTO default_list_id;
            
            -- Copy current product prices to the default price list
            INSERT INTO public.product_prices (product_id, price_list_id, price)
            SELECT id, default_list_id, price
            FROM public.products
            WHERE company_id = company_record.id AND price IS NOT NULL;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 7. AUTO-CREATE PRODUCT PRICES FOR NEW PRODUCTS
-- =====================================================
-- When a new product is created, automatically add it to the default price list
CREATE OR REPLACE FUNCTION auto_add_product_to_default_price_list()
RETURNS TRIGGER AS $$
DECLARE
    default_list_id UUID;
BEGIN
    -- Get the default price list for this company
    SELECT id INTO default_list_id
    FROM public.price_lists
    WHERE company_id = NEW.company_id
      AND is_default = true
    LIMIT 1;
    
    -- If a default price list exists and product has a price
    IF default_list_id IS NOT NULL AND NEW.price IS NOT NULL THEN
        INSERT INTO public.product_prices (product_id, price_list_id, price)
        VALUES (NEW.id, default_list_id, NEW.price)
        ON CONFLICT (product_id, price_list_id) DO UPDATE
        SET price = EXCLUDED.price;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_add_product_to_default_price_list_trigger
    AFTER INSERT OR UPDATE OF price ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION auto_add_product_to_default_price_list();

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE public.price_lists IS 'Stores different pricing tiers (retail, wholesale, VIP, etc.)';
COMMENT ON TABLE public.product_prices IS 'Stores specific prices for each product in each price list';
COMMENT ON COLUMN public.customers.price_list_id IS 'Default price list assigned to this customer';
COMMENT ON FUNCTION ensure_single_default_price_list() IS 'Ensures only one price list is marked as default per company';
COMMENT ON FUNCTION auto_add_product_to_default_price_list() IS 'Automatically adds new products to the default price list with their base price';
