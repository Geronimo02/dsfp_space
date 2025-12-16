-- Corregir suppliers para que tenga precio 0 ya que es parte básica de compras
UPDATE platform_modules SET price_monthly = 0, price_annual = 0 WHERE code = 'suppliers';

-- Asegurar que settings esté marcado como base
UPDATE platform_modules SET is_base = true, price_monthly = 0, price_annual = 0 WHERE code = 'settings';

-- Corregir employees para que se llame correctamente
UPDATE platform_modules SET name = 'Empleados' WHERE code = 'employees';