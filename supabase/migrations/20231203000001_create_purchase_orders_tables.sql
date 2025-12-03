-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'received', 'cancelled')),
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    delivery_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(company_id, order_number)
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(12, 2) NOT NULL CHECK (unit_cost >= 0),
    subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_receptions table
CREATE TABLE IF NOT EXISTS purchase_receptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    reception_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create purchase_returns table
CREATE TABLE IF NOT EXISTS purchase_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    return_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(company_id, return_number)
);

-- Create purchase_return_items table
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(12, 2) NOT NULL CHECK (unit_cost >= 0),
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_purchase_orders_company ON purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at DESC);

CREATE INDEX idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product ON purchase_order_items(product_id);

CREATE INDEX idx_purchase_receptions_company ON purchase_receptions(company_id);
CREATE INDEX idx_purchase_receptions_order ON purchase_receptions(purchase_order_id);
CREATE INDEX idx_purchase_receptions_warehouse ON purchase_receptions(warehouse_id);

CREATE INDEX idx_purchase_returns_company ON purchase_returns(company_id);
CREATE INDEX idx_purchase_returns_supplier ON purchase_returns(supplier_id);
CREATE INDEX idx_purchase_returns_status ON purchase_returns(status);
CREATE INDEX idx_purchase_returns_created_at ON purchase_returns(created_at DESC);

CREATE INDEX idx_purchase_return_items_return ON purchase_return_items(purchase_return_id);
CREATE INDEX idx_purchase_return_items_product ON purchase_return_items(product_id);

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view purchase orders from their company"
    ON purchase_orders FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "Users can create purchase orders in their company"
    ON purchase_orders FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "Users can update purchase orders in their company"
    ON purchase_orders FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "Users can delete purchase orders in their company"
    ON purchase_orders FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

-- RLS Policies for purchase_order_items
CREATE POLICY "Users can view purchase order items from their company"
    ON purchase_order_items FOR SELECT
    USING (
        purchase_order_id IN (
            SELECT id FROM purchase_orders
            WHERE company_id IN (
                SELECT company_id FROM company_users 
                WHERE user_id = auth.uid() AND active = true
            )
        )
    );

CREATE POLICY "Users can insert purchase order items"
    ON purchase_order_items FOR INSERT
    WITH CHECK (
        purchase_order_id IN (
            SELECT id FROM purchase_orders
            WHERE company_id IN (
                SELECT company_id FROM company_users 
                WHERE user_id = auth.uid() AND active = true
            )
        )
    );

CREATE POLICY "Users can update purchase order items"
    ON purchase_order_items FOR UPDATE
    USING (
        purchase_order_id IN (
            SELECT id FROM purchase_orders
            WHERE company_id IN (
                SELECT company_id FROM company_users 
                WHERE user_id = auth.uid() AND active = true
            )
        )
    );

CREATE POLICY "Users can delete purchase order items"
    ON purchase_order_items FOR DELETE
    USING (
        purchase_order_id IN (
            SELECT id FROM purchase_orders
            WHERE company_id IN (
                SELECT company_id FROM company_users 
                WHERE user_id = auth.uid() AND active = true
            )
        )
    );

-- RLS Policies for purchase_receptions (similar pattern)
CREATE POLICY "Users can view purchase receptions from their company"
    ON purchase_receptions FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "Users can create purchase receptions"
    ON purchase_receptions FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

-- RLS Policies for purchase_returns
CREATE POLICY "Users can view purchase returns from their company"
    ON purchase_returns FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "Users can create purchase returns"
    ON purchase_returns FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "Users can update purchase returns"
    ON purchase_returns FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "Users can delete purchase returns"
    ON purchase_returns FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM company_users 
            WHERE user_id = auth.uid() AND active = true
        )
    );

-- RLS Policies for purchase_return_items
CREATE POLICY "Users can view purchase return items"
    ON purchase_return_items FOR SELECT
    USING (
        purchase_return_id IN (
            SELECT id FROM purchase_returns
            WHERE company_id IN (
                SELECT company_id FROM company_users 
                WHERE user_id = auth.uid() AND active = true
            )
        )
    );

CREATE POLICY "Users can insert purchase return items"
    ON purchase_return_items FOR INSERT
    WITH CHECK (
        purchase_return_id IN (
            SELECT id FROM purchase_returns
            WHERE company_id IN (
                SELECT company_id FROM company_users 
                WHERE user_id = auth.uid() AND active = true
            )
        )
    );

CREATE POLICY "Users can update purchase return items"
    ON purchase_return_items FOR UPDATE
    USING (
        purchase_return_id IN (
            SELECT id FROM purchase_returns
            WHERE company_id IN (
                SELECT company_id FROM company_users 
                WHERE user_id = auth.uid() AND active = true
            )
        )
    );

CREATE POLICY "Users can delete purchase return items"
    ON purchase_return_items FOR DELETE
    USING (
        purchase_return_id IN (
            SELECT id FROM purchase_returns
            WHERE company_id IN (
                SELECT company_id FROM company_users 
                WHERE user_id = auth.uid() AND active = true
            )
        )
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_orders_updated_at();

CREATE TRIGGER purchase_returns_updated_at
    BEFORE UPDATE ON purchase_returns
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_orders_updated_at();
