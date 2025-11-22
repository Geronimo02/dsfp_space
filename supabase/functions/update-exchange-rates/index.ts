import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BancoNacionRate {
  venta: number;
  compra: number;
}

interface BancoNacionResponse {
  'Dolar U.S.A': BancoNacionRate;
  'Euro': BancoNacionRate;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting exchange rate update from Banco Nación...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch exchange rates from Banco Nación API
    const bancoNacionResponse = await fetch('https://www.bna.com.ar/Cotizador/LatestPrices', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!bancoNacionResponse.ok) {
      throw new Error(`Banco Nación API error: ${bancoNacionResponse.statusText}`);
    }

    const bancoNacionData: BancoNacionResponse = await bancoNacionResponse.json();
    console.log('Fetched rates from Banco Nación:', bancoNacionData);

    // Extract USD and EUR rates (using "venta" price)
    const usdRate = bancoNacionData['Dolar U.S.A']?.venta;
    const eurRate = bancoNacionData['Euro']?.venta;

    if (!usdRate || !eurRate) {
      throw new Error('Could not extract USD or EUR rates from Banco Nación response');
    }

    // Get all companies with auto-update enabled
    const { data: settings, error: settingsError } = await supabase
      .from('exchange_rate_settings')
      .select('company_id, last_update')
      .eq('auto_update', true)
      .eq('source', 'banco_nacion');

    if (settingsError) {
      throw new Error(`Error fetching settings: ${settingsError.message}`);
    }

    // If no companies have auto-update enabled, update all active companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id')
      .eq('active', true);

    if (companiesError) {
      throw new Error(`Error fetching companies: ${companiesError.message}`);
    }

    const companyIds = settings && settings.length > 0 
      ? settings.map(s => s.company_id)
      : (companies || []).map(c => c.id);

    let updatedCount = 0;
    const results: any[] = [];

    // Update rates for each company
    for (const companyId of companyIds) {
      try {
        // Get current rates
        const { data: currentRates } = await supabase
          .from('exchange_rates')
          .select('currency, rate')
          .eq('company_id', companyId)
          .in('currency', ['USD', 'EUR']);

        const currentUsdRate = currentRates?.find(r => r.currency === 'USD')?.rate;
        const currentEurRate = currentRates?.find(r => r.currency === 'EUR')?.rate;

        // Update USD
        if (currentUsdRate !== usdRate) {
          const { error: usdError } = await supabase
            .from('exchange_rates')
            .upsert({
              company_id: companyId,
              currency: 'USD',
              rate: usdRate,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,currency'
            });

          if (!usdError) {
            // Log history
            await supabase.from('exchange_rate_history').insert({
              company_id: companyId,
              currency: 'USD',
              old_rate: currentUsdRate,
              new_rate: usdRate,
              source: 'banco_nacion',
            });
            updatedCount++;
          }
        }

        // Update EUR
        if (currentEurRate !== eurRate) {
          const { error: eurError } = await supabase
            .from('exchange_rates')
            .upsert({
              company_id: companyId,
              currency: 'EUR',
              rate: eurRate,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,currency'
            });

          if (!eurError) {
            // Log history
            await supabase.from('exchange_rate_history').insert({
              company_id: companyId,
              currency: 'EUR',
              old_rate: currentEurRate,
              new_rate: eurRate,
              source: 'banco_nacion',
            });
            updatedCount++;
          }
        }

        // Update last_update timestamp in settings
        await supabase
          .from('exchange_rate_settings')
          .upsert({
            company_id: companyId,
            last_update: new Date().toISOString(),
            auto_update: true,
            source: 'banco_nacion',
          }, {
            onConflict: 'company_id'
          });

        results.push({
          company_id: companyId,
          success: true,
          usd_rate: usdRate,
          eur_rate: eurRate,
        });

      } catch (error: any) {
        console.error(`Error updating rates for company ${companyId}:`, error);
        results.push({
          company_id: companyId,
          success: false,
          error: error?.message || 'Unknown error',
        });
      }
    }

    console.log(`Successfully updated ${updatedCount} exchange rates across ${companyIds.length} companies`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updatedCount} exchange rates for ${companyIds.length} companies`,
        rates: {
          USD: usdRate,
          EUR: eurRate,
        },
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error updating exchange rates:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
