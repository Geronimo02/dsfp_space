-- =============================================
-- INTEGRACIÓN AFIP - TOKENS Y CERTIFICADOS
-- Almacenamiento de credenciales y certificados digitales
-- =============================================

-- 1. AGREGAR CAMPOS PARA CERTIFICADOS EN COMPANIES
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS cuit TEXT,
  ADD COLUMN IF NOT EXISTS afip_certificate TEXT, -- Base64 del certificado .crt
  ADD COLUMN IF NOT EXISTS afip_private_key TEXT, -- Base64 de la clave privada .key (encriptada)
  ADD COLUMN IF NOT EXISTS afip_ambiente TEXT DEFAULT 'testing', -- testing o production
  ADD COLUMN IF NOT EXISTS afip_enabled BOOLEAN DEFAULT false;

-- Comentarios
COMMENT ON COLUMN public.companies.cuit IS 'CUIT de la empresa (11 dígitos sin guiones)';
COMMENT ON COLUMN public.companies.afip_certificate IS 'Certificado digital AFIP en Base64';
COMMENT ON COLUMN public.companies.afip_private_key IS 'Clave privada del certificado en Base64 (encriptada)';
COMMENT ON COLUMN public.companies.afip_ambiente IS 'Ambiente AFIP: testing (homologación) o production';
COMMENT ON COLUMN public.companies.afip_enabled IS 'Si está habilitada la facturación electrónica AFIP';

-- 2. CREAR TABLA PARA TOKENS AFIP (cache)
CREATE TABLE IF NOT EXISTS public.afip_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service TEXT NOT NULL, -- 'wsfe', 'wsfex', etc.
  token TEXT NOT NULL,
  sign TEXT NOT NULL,
  expiration TIMESTAMP WITH TIME ZONE NOT NULL,
  ambiente TEXT NOT NULL, -- 'testing' o 'production'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, service, ambiente)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_afip_tokens_company ON public.afip_tokens(company_id);
CREATE INDEX IF NOT EXISTS idx_afip_tokens_expiration ON public.afip_tokens(expiration) WHERE expiration > now();

-- Comentarios
COMMENT ON TABLE public.afip_tokens IS 'Cache de tokens de autenticación AFIP (WSAA)';
COMMENT ON COLUMN public.afip_tokens.token IS 'Token de acceso obtenido de WSAA';
COMMENT ON COLUMN public.afip_tokens.sign IS 'Firma digital del token';
COMMENT ON COLUMN public.afip_tokens.expiration IS 'Fecha de vencimiento del token';

-- 3. TRIGGER PARA AUTO-ACTUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_afip_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS afip_tokens_updated_at ON afip_tokens;

CREATE TRIGGER afip_tokens_updated_at
  BEFORE UPDATE ON afip_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_afip_tokens_timestamp();

-- 4. RLS POLICIES PARA afip_tokens
ALTER TABLE public.afip_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tokens of their company" ON public.afip_tokens;
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.afip_tokens;

CREATE POLICY "Users can view tokens of their company"
  ON public.afip_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = afip_tokens.company_id
      AND cu.user_id = auth.uid()
      AND cu.active = true
    )
  );

-- Allow service role (Edge Functions) to manage tokens
CREATE POLICY "Service role can manage tokens"
  ON public.afip_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. FUNCIÓN PARA LIMPIAR TOKENS EXPIRADOS
CREATE OR REPLACE FUNCTION clean_expired_afip_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.afip_tokens
  WHERE expiration < now() - interval '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON FUNCTION clean_expired_afip_tokens() IS 'Elimina tokens AFIP expirados hace más de 1 día';

-- 6. AGREGAR CAMPO PARA ESTADO DE CONTINGENCIA
ALTER TABLE public.comprobantes_afip
  ADD COLUMN IF NOT EXISTS contingencia BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enviado_afip BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS intentos_envio INTEGER DEFAULT 0;

COMMENT ON COLUMN public.comprobantes_afip.contingencia IS 'Comprobante generado en modo contingencia (sin conexión AFIP)';
COMMENT ON COLUMN public.comprobantes_afip.enviado_afip IS 'Si el comprobante fue enviado y aprobado por AFIP';
COMMENT ON COLUMN public.comprobantes_afip.intentos_envio IS 'Cantidad de intentos de envío a AFIP';

-- 7. ÍNDICE PARA COMPROBANTES PENDIENTES DE ENVÍO
CREATE INDEX IF NOT EXISTS idx_comprobantes_pendientes 
  ON public.comprobantes_afip(company_id, contingencia, enviado_afip)
  WHERE contingencia = true AND enviado_afip = false;

COMMENT ON INDEX idx_comprobantes_pendientes IS 'Índice para encontrar comprobantes en contingencia pendientes de envío';
