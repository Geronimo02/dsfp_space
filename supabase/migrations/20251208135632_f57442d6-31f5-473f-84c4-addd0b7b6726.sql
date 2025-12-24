-- Habilitar REPLICA IDENTITY FULL para que los cambios en tiempo real incluyan todos los datos
ALTER TABLE public.company_modules REPLICA IDENTITY FULL;

-- Agregar la tabla a la publicación de realtime (si no está ya)
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_modules;