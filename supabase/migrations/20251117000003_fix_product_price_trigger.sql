-- Fix trigger function to work with RLS policies
-- The auto_add_product_to_default_price_list function needs SECURITY DEFINER
-- to bypass RLS when automatically creating product prices

DROP FUNCTION IF EXISTS auto_add_product_to_default_price_list() CASCADE;

CREATE OR REPLACE FUNCTION auto_add_product_to_default_price_list()
RETURNS TRIGGER 
SECURITY DEFINER  -- This makes the function run with owner privileges
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    default_list_id UUID;
BEGIN
    -- Get the default price list for this company
    SELECT id INTO default_list_id
    FROM public.price_lists
    WHERE company_id = NEW.company_id
      AND is_default = true
      AND is_active = true
    LIMIT 1;
    
    -- If a default price list exists and product has a price
    IF default_list_id IS NOT NULL AND NEW.price IS NOT NULL THEN
        INSERT INTO public.product_prices (product_id, price_list_id, price)
        VALUES (NEW.id, default_list_id, NEW.price)
        ON CONFLICT (product_id, price_list_id) DO UPDATE
        SET price = EXCLUDED.price;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the product creation
        RAISE WARNING 'Failed to auto-add product to price list: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS auto_add_product_to_default_price_list_trigger ON public.products;

CREATE TRIGGER auto_add_product_to_default_price_list_trigger
    AFTER INSERT OR UPDATE OF price ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION auto_add_product_to_default_price_list();

COMMENT ON FUNCTION auto_add_product_to_default_price_list() IS 'Automatically adds new products to the default price list with their base price. Runs with SECURITY DEFINER to bypass RLS.';
