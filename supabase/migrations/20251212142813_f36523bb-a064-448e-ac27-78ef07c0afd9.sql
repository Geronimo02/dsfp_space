
-- Enable REPLICA IDENTITY FULL for company_modules to ensure realtime updates work properly
ALTER TABLE public.company_modules REPLICA IDENTITY FULL;
