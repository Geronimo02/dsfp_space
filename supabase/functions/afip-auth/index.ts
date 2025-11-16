// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// WSAA endpoints
const WSAA_ENDPOINTS = {
  testing: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  production: "https://wsaa.afip.gov.ar/ws/services/LoginCms"
};

interface AuthRequest {
  companyId: string;
  service: string; // 'wsfe' for facturación electrónica
  ambiente: 'testing' | 'production';
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { companyId, service, ambiente }: AuthRequest = await req.json();

    // Get company data with certificate
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('cuit, afip_certificate, afip_private_key, afip_ambiente')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    if (!company.afip_certificate || !company.afip_private_key) {
      throw new Error('AFIP certificate not configured');
    }

    // Generate TRA (Ticket de Requerimiento de Acceso)
    const tra = generateTRA(service, company.cuit);
    
    // Sign TRA with certificate
    const cms = await signTRA(tra, company.afip_certificate, company.afip_private_key);
    
    // Call WSAA
    const endpoint = WSAA_ENDPOINTS[ambiente];
    const soapRequest = buildWSAASoapRequest(cms);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
      },
      body: soapRequest,
    });

    if (!response.ok) {
      throw new Error(`AFIP WSAA error: ${response.statusText}`);
    }

    const xmlResponse = await response.text();
    const credentials = parseWSAAResponse(xmlResponse);

    // Store credentials in database for caching
    await supabaseClient
      .from('afip_tokens')
      .upsert({
        company_id: companyId,
        service: service,
        token: credentials.token,
        sign: credentials.sign,
        expiration: credentials.expiration,
        ambiente: ambiente,
      });

    return new Response(
      JSON.stringify(credentials),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in afip-auth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function generateTRA(service: string, cuit: string): string {
  const now = new Date();
  const expirationTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours
  
  const uniqueId = Math.floor(Math.random() * 100000000);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${now.toISOString()}</generationTime>
    <expirationTime>${expirationTime.toISOString()}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

async function signTRA(tra: string, certificate: string, privateKey: string): Promise<string> {
  // Decode base64 certificate and private key
  const certPem = atob(certificate);
  const keyPem = atob(privateKey);
  
  // For Deno, we need to use the crypto API
  // This is a simplified version - in production you'd use a proper crypto library
  // like @peculiar/x509 or node-forge compiled for Deno
  
  // For now, we'll use an external service or implement with WebCrypto
  // This is a placeholder that needs proper PKCS#7 signing implementation
  
  const encoder = new TextEncoder();
  const data = encoder.encode(tra);
  
  // Import private key
  const keyData = pemToArrayBuffer(keyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  
  // Sign the TRA
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    data
  );
  
  // Create CMS (PKCS#7) structure
  // This is simplified - real implementation needs proper ASN.1 encoding
  const cms = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return cms;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function buildWSAASoapRequest(cms: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseWSAAResponse(xml: string): { token: string; sign: string; expiration: string } {
  // Parse XML response to extract token, sign, and expiration
  // This is a simplified parser - in production use a proper XML parser
  
  const tokenMatch = xml.match(/<token>(.*?)<\/token>/s);
  const signMatch = xml.match(/<sign>(.*?)<\/sign>/s);
  const expirationMatch = xml.match(/<expirationTime>(.*?)<\/expirationTime>/s);
  
  if (!tokenMatch || !signMatch || !expirationMatch) {
    throw new Error('Invalid WSAA response');
  }
  
  return {
    token: tokenMatch[1].trim(),
    sign: signMatch[1].trim(),
    expiration: expirationMatch[1].trim(),
  };
}
