-- Fix RLS error when creating products by running trigger as SECURITY DEFINER
-- and ensure default price list exists for new companies.
-- Date: 2025-11-14

-- 1) Recreate auto_add_product_to_default_price_list() as SECURITY DEFINER
DROP FUNCTION IF EXISTS public.auto_add_product_to_default_price_list();
CREATE OR REPLACE FUNCTION public.auto_add_product_to_default_price_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_list_id UUID;
BEGIN
    -- Get the default price list for this company (no reliance on auth.uid())
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
$$;

-- Recreate trigger to ensure it points to the recreated function (idempotent)
DROP TRIGGER IF EXISTS auto_add_product_to_default_price_list_trigger ON public.products;
CREATE TRIGGER auto_add_product_to_default_price_list_trigger
    AFTER INSERT OR UPDATE OF price ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_add_product_to_default_price_list();

-- 2) Auto-create default price list for new companies
DROP FUNCTION IF EXISTS public.create_default_price_list_for_company();
CREATE OR REPLACE FUNCTION public.create_default_price_list_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_exists BOOLEAN;
BEGIN
    -- If company already has a default list, do nothing
    SELECT EXISTS (
        SELECT 1 FROM public.price_lists
        WHERE company_id = NEW.id AND is_default = true
    ) INTO default_exists;

    IF NOT default_exists THEN
        INSERT INTO public.price_lists (company_id, name, description, is_default, is_active)
        VALUES (
            NEW.id,
            'Lista Minorista',
            'Lista de precios por defecto para ventas al público',
            true,
            true
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Attach trigger to companies
DROP TRIGGER IF EXISTS create_default_price_list_on_company ON public.companies;
CREATE TRIGGER create_default_price_list_on_company
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_price_list_for_company();

-- 3) Backfill: ensure every existing company has a default list (idempotent)
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN SELECT id FROM public.companies LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.price_lists WHERE company_id = c.id AND is_default = true
        ) THEN
            INSERT INTO public.price_lists (company_id, name, description, is_default, is_active)
            VALUES (
                c.id,
                'Lista Minorista',
                'Lista de precios por defecto para ventas al público',
                true,
                true
            );
        END IF;
    END LOOP;
END$$;
