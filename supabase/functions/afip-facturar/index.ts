// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// WSFEv1 endpoints
const WSFE_ENDPOINTS = {
  testing: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  production: "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
};

interface FacturaRequest {
  companyId: string;
  posAfipId: string;
  puntoVenta: number;
  tipoComprobante: number; // 1=A, 6=B, 11=C, etc.
  concepto: number; // 1=Productos, 2=Servicios, 3=Ambos
  fecha: string;
  clienteDocTipo: number; // 80=CUIT, 96=DNI, etc.
  clienteDocNro: string;
  importeTotal: number;
  importeNeto: number;
  importeIVA: number;
  importeTributos: number;
  importeExento: number;
  importeNoGravado: number;
  iva: Array<{
    id: number; // 3=0%, 4=10.5%, 5=21%, 6=27%
    baseImp: number;
    importe: number;
  }>;
  ambiente: 'testing' | 'production';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const facturaData: FacturaRequest = await req.json();

    // Get or refresh AFIP token
    const credentials = await getAFIPCredentials(
      supabaseClient,
      facturaData.companyId,
      facturaData.ambiente
    );

    // Get next comprobante number
    const { data: ultimoNro, error: ultimoError } = await supabaseClient
      .rpc('get_next_comprobante_number', {
        _pos_afip_id: facturaData.posAfipId
      });

    if (ultimoError) {
      throw new Error(`Error getting next number: ${ultimoError.message}`);
    }

    const numeroComprobante = ultimoNro;

    // Build SOAP request for CAESolicitar
    const soapRequest = buildCAESolicitarRequest(
      credentials,
      facturaData,
      numeroComprobante
    );

    // Call AFIP WSFEv1
    const endpoint = WSFE_ENDPOINTS[facturaData.ambiente];
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
      },
      body: soapRequest,
    });

    if (!response.ok) {
      throw new Error(`AFIP WSFEv1 error: ${response.statusText}`);
    }

    const xmlResponse = await response.text();
    const result = parseCAEResponse(xmlResponse);

    if (result.errors && result.errors.length > 0) {
      throw new Error(`AFIP error: ${result.errors.join(', ')}`);
    }

    // Save comprobante in database
    const numeroCompleto = `${String(facturaData.puntoVenta).padStart(4, '0')}-${String(numeroComprobante).padStart(8, '0')}`;
    
    const { error: insertError } = await supabaseClient
      .from('comprobantes_afip')
      .insert({
        company_id: facturaData.companyId,
        pos_afip_id: facturaData.posAfipId,
        tipo_comprobante: getTipoComprobanteString(facturaData.tipoComprobante),
        punto_venta: facturaData.puntoVenta,
        numero_comprobante: numeroComprobante,
        numero_completo: numeroCompleto,
        cae: result.cae,
        fecha_vencimiento_cae: result.vencimiento,
        fecha_emision: new Date().toISOString(),
        importe_total: facturaData.importeTotal,
        estado: 'aprobado',
        response_afip: result.fullResponse,
      });

    if (insertError) {
      console.error('Error saving comprobante:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        cae: result.cae,
        vencimiento: result.vencimiento,
        numeroComprobante: numeroCompleto,
        numeroInterno: numeroComprobante,
        observaciones: result.observaciones,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in afip-facturar:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function getAFIPCredentials(supabaseClient: any, companyId: string, ambiente: string) {
  // Check if we have valid cached credentials
  const { data: cachedToken } = await supabaseClient
    .from('afip_tokens')
    .select('*')
    .eq('company_id', companyId)
    .eq('service', 'wsfe')
    .eq('ambiente', ambiente)
    .single();

  if (cachedToken && new Date(cachedToken.expiration) > new Date()) {
    return {
      token: cachedToken.token,
      sign: cachedToken.sign,
    };
  }

  // Need to get new credentials - call afip-auth function
  throw new Error('AFIP token expired. Please refresh authentication.');
}

function buildCAESolicitarRequest(
  credentials: any,
  factura: FacturaRequest,
  numeroComprobante: number
): string {
  const { token, sign } = credentials;
  
  // Get company CUIT (should be passed in factura or fetched)
  const cuit = "20123456789"; // This should come from company data

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${factura.puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${factura.tipoComprobante}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${factura.concepto}</ar:Concepto>
            <ar:DocTipo>${factura.clienteDocTipo}</ar:DocTipo>
            <ar:DocNro>${factura.clienteDocNro}</ar:DocNro>
            <ar:CbteDesde>${numeroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${numeroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${factura.fecha.replace(/-/g, '')}</ar:CbteFch>
            <ar:ImpTotal>${factura.importeTotal.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>${factura.importeNoGravado.toFixed(2)}</ar:ImpTotConc>
            <ar:ImpNeto>${factura.importeNeto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>${factura.importeExento.toFixed(2)}</ar:ImpOpEx>
            <ar:ImpTrib>${factura.importeTributos.toFixed(2)}</ar:ImpTrib>
            <ar:ImpIVA>${factura.importeIVA.toFixed(2)}</ar:ImpIVA>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>
            ${buildIVAArray(factura.iva)}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function buildIVAArray(ivas: Array<{ id: number; baseImp: number; importe: number }>): string {
  if (!ivas || ivas.length === 0) return '';
  
  const ivaItems = ivas.map(iva => `
    <ar:AlicIva>
      <ar:Id>${iva.id}</ar:Id>
      <ar:BaseImp>${iva.baseImp.toFixed(2)}</ar:BaseImp>
      <ar:Importe>${iva.importe.toFixed(2)}</ar:Importe>
    </ar:AlicIva>
  `).join('');

  return `<ar:Iva>${ivaItems}</ar:Iva>`;
}

function parseCAEResponse(xml: string): any {
  const caeMatch = xml.match(/<CAE>(.*?)<\/CAE>/);
  const vencimientoMatch = xml.match(/<CAEFchVto>(.*?)<\/CAEFchVto>/);
  const resultadoMatch = xml.match(/<Resultado>(.*?)<\/Resultado>/);
  
  const errors: string[] = [];
  const errRegex = /<Msg>(.*?)<\/Msg>/g;
  let match;
  while ((match = errRegex.exec(xml)) !== null) {
    errors.push(match[1]);
  }

  const observaciones: string[] = [];
  const obsRegex = /<Obs>(.*?)<\/Obs>/g;
  while ((match = obsRegex.exec(xml)) !== null) {
    observaciones.push(match[1]);
  }

  return {
    cae: caeMatch ? caeMatch[1] : null,
    vencimiento: vencimientoMatch ? formatDate(vencimientoMatch[1]) : null,
    resultado: resultadoMatch ? resultadoMatch[1] : null,
    errors: errors.length > 0 ? errors : null,
    observaciones: observaciones.length > 0 ? observaciones : null,
    fullResponse: xml,
  };
}

function formatDate(dateStr: string): string {
  // Convert YYYYMMDD to YYYY-MM-DD
  if (dateStr.length === 8) {
    return `${dateStr.substr(0, 4)}-${dateStr.substr(4, 2)}-${dateStr.substr(6, 2)}`;
  }
  return dateStr;
}

function getTipoComprobanteString(tipo: number): string {
  const tipos: { [key: number]: string } = {
    1: 'FACTURA_A',
    6: 'FACTURA_B',
    11: 'FACTURA_C',
    3: 'NOTA_CREDITO_A',
    8: 'NOTA_CREDITO_B',
    13: 'NOTA_CREDITO_C',
  };
  return tipos[tipo] || `TIPO_${tipo}`;
}
