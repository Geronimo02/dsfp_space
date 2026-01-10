-- Create api_requests table for rate limiting
CREATE TABLE IF NOT EXISTS public.api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  allowed BOOLEAN DEFAULT true,
  error_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_requests_company_endpoint_created ON public.api_requests(company_id, endpoint, created_at DESC);
CREATE INDEX idx_api_requests_created_at ON public.api_requests(created_at DESC);

-- Cleanup old requests automatically (older than 30 days)
-- This could be a scheduled job or trigger, but for now just document it
-- SELECT FROM api_requests WHERE created_at < NOW() - INTERVAL '30 days';
