-- =============================================
-- AGREGAR SOPORTE DE MONEDA A PRODUCTOS
-- =============================================
-- Esta migración agrega:
-- 1. Campo currency a la tabla products
-- 2. Aumenta la precisión de price y cost de DECIMAL(10,2) a DECIMAL(12,2)

-- Paso 1: Eliminar el trigger temporalmente para poder modificar la columna price
DROP TRIGGER IF EXISTS auto_add_product_to_default_price_list_trigger ON public.products;

-- Paso 2: Agregar columna currency a products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ARS' NOT NULL;

-- Comentario para documentar el campo
COMMENT ON COLUMN public.products.currency IS 'Código de moneda ISO 4217 (ARS, USD, EUR, etc.)';

-- Paso 3: Modificar precisión de price de DECIMAL(10,2) a DECIMAL(12,2)
-- Esto permite valores hasta 9,999,999,999.99 en lugar de 99,999,999.99
ALTER TABLE public.products 
ALTER COLUMN price TYPE DECIMAL(12,2);

-- Paso 4: Modificar precisión de cost de DECIMAL(10,2) a DECIMAL(12,2)
ALTER TABLE public.products 
ALTER COLUMN cost TYPE DECIMAL(12,2);

-- Paso 5: Crear índice para mejorar búsquedas por moneda
CREATE INDEX IF NOT EXISTS idx_products_currency ON public.products(currency);

-- Paso 6: Agregar constraint para validar que la moneda sea un código válido ISO 4217
ALTER TABLE public.products
ADD CONSTRAINT check_valid_currency 
CHECK (currency ~ '^[A-Z]{3}$');

-- Paso 7: Recrear el trigger que fue eliminado
CREATE TRIGGER auto_add_product_to_default_price_list_trigger
    AFTER INSERT OR UPDATE OF price ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION auto_add_product_to_default_price_list();

-- Comentario para documentar los cambios
COMMENT ON TABLE public.products IS 'Tabla de productos con soporte multi-moneda. Actualizado para permitir precios hasta 9,999,999,999.99';
