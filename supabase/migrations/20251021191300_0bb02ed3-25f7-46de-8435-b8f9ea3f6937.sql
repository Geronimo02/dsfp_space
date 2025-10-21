-- Create notifications table for system alerts
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert notifications (admins and managers)
CREATE POLICY "Admins and managers can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Add inventory management fields to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS expiration_date DATE,
ADD COLUMN IF NOT EXISTS last_restock_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 0;

-- Create function to check low stock and generate notifications
CREATE OR REPLACE FUNCTION public.check_low_stock_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  low_stock_product RECORD;
  admin_user_id UUID;
BEGIN
  -- Get first admin user to send notifications
  SELECT user_id INTO admin_user_id
  FROM user_roles
  WHERE role = 'admin'::app_role
  LIMIT 1;

  -- Find products with low stock that haven't been notified recently
  FOR low_stock_product IN
    SELECT p.id, p.name, p.stock, p.min_stock, p.sku
    FROM products p
    WHERE p.active = true
      AND p.stock <= p.min_stock
      AND p.min_stock > 0
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.type = 'low_stock'
          AND (n.data->>'product_id')::uuid = p.id
          AND n.created_at > now() - INTERVAL '24 hours'
      )
  LOOP
    -- Insert notification for each low stock product
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      admin_user_id,
      'low_stock',
      'Stock Bajo: ' || low_stock_product.name,
      'El producto ' || low_stock_product.name || ' tiene stock bajo (' || low_stock_product.stock || ' unidades). Mínimo: ' || low_stock_product.min_stock,
      jsonb_build_object(
        'product_id', low_stock_product.id,
        'product_name', low_stock_product.name,
        'current_stock', low_stock_product.stock,
        'min_stock', low_stock_product.min_stock,
        'sku', low_stock_product.sku
      )
    );
  END LOOP;
END;
$$;

-- Create function to check expiring products
CREATE OR REPLACE FUNCTION public.check_expiring_products()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  expiring_product RECORD;
  admin_user_id UUID;
BEGIN
  -- Get first admin user to send notifications
  SELECT user_id INTO admin_user_id
  FROM user_roles
  WHERE role = 'admin'::app_role
  LIMIT 1;

  -- Find products expiring in next 30 days
  FOR expiring_product IN
    SELECT p.id, p.name, p.expiration_date, p.batch_number, p.stock
    FROM products p
    WHERE p.active = true
      AND p.expiration_date IS NOT NULL
      AND p.expiration_date <= (CURRENT_DATE + INTERVAL '30 days')
      AND p.expiration_date >= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.type = 'expiring_product'
          AND (n.data->>'product_id')::uuid = p.id
          AND n.created_at > now() - INTERVAL '7 days'
      )
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      admin_user_id,
      'expiring_product',
      'Producto Próximo a Vencer: ' || expiring_product.name,
      'El producto ' || expiring_product.name || ' (Lote: ' || COALESCE(expiring_product.batch_number, 'N/A') || ') vence el ' || TO_CHAR(expiring_product.expiration_date, 'DD/MM/YYYY'),
      jsonb_build_object(
        'product_id', expiring_product.id,
        'product_name', expiring_product.name,
        'expiration_date', expiring_product.expiration_date,
        'batch_number', expiring_product.batch_number,
        'stock', expiring_product.stock
      )
    );
  END LOOP;
END;
$$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_stock_alert ON public.products(stock, min_stock) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_expiration ON public.products(expiration_date) WHERE active = true AND expiration_date IS NOT NULL;