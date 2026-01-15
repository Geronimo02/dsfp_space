-- Add bulk_email module to platform_modules
INSERT INTO public.platform_modules (
    code, 
    name, 
    description, 
    price_monthly, 
    price_yearly, 
    is_base, 
    display_order,
    category,
    is_active
) VALUES (
    'bulk_email', 
    'Envío de Correos Masivos', 
    'Envío masivo de emails personalizados a clientes', 
    4000, 
    40800, 
    FALSE, 
    76,
    'operaciones',
    TRUE
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active;
