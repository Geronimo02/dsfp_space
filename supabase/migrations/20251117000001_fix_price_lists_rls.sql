-- Fix RLS policies for price_lists to work correctly with JOINs
-- The issue is that when product_prices does a JOIN with price_lists,
-- the RLS policy needs to allow access based on the relationship

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company's price lists" ON public.price_lists;
DROP POLICY IF EXISTS "Users can insert price lists for their company" ON public.price_lists;
DROP POLICY IF EXISTS "Users can update their company's price lists" ON public.price_lists;
DROP POLICY IF EXISTS "Users can delete their company's price lists" ON public.price_lists;

-- Recreate policies with better logic
CREATE POLICY "Users can view their company's price lists"
    ON public.price_lists FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "Admins and managers can insert price lists for their company"
    ON public.price_lists FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT cu.company_id FROM public.company_users cu
            WHERE cu.user_id = auth.uid() 
              AND cu.active = true
              AND cu.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins and managers can update their company's price lists"
    ON public.price_lists FOR UPDATE
    USING (
        company_id IN (
            SELECT cu.company_id FROM public.company_users cu
            WHERE cu.user_id = auth.uid() 
              AND cu.active = true
              AND cu.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins can delete their company's price lists"
    ON public.price_lists FOR DELETE
    USING (
        company_id IN (
            SELECT cu.company_id FROM public.company_users cu
            WHERE cu.user_id = auth.uid() 
              AND cu.active = true
              AND cu.role = 'admin'
        )
    );
