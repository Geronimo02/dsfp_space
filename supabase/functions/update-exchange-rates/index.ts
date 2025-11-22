import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DolarApiResponse {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting exchange rate update from DolarApi...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch USD rate from DolarApi (Dólar Oficial)
    const usdResponse = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!usdResponse.ok) {
      console.error('DolarApi USD error:', usdResponse.status, usdResponse.statusText);
      const responseText = await usdResponse.text();
      console.error('Response body:', responseText);
      throw new Error(`DolarApi USD error: ${usdResponse.statusText}`);
    }

    const usdData: DolarApiResponse = await usdResponse.json();
    console.log('Fetched USD rate from DolarApi:', usdData);

    // Fetch EUR rate from DolarApi (Euro Oficial)
    const eurResponse = await fetch('https://dolarapi.com/v1/cotizaciones/eur', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!eurResponse.ok) {
      console.error('DolarApi EUR error:', eurResponse.status, eurResponse.statusText);
      const responseText = await eurResponse.text();
      console.error('Response body:', responseText);
      throw new Error(`DolarApi EUR error: ${eurResponse.statusText}`);
    }

    const eurData: DolarApiResponse = await eurResponse.json();
    console.log('Fetched EUR rate from DolarApi:', eurData);

    // Use the "venta" (sell) price as the exchange rate
    const usdRate = usdData.venta;
    const eurRate = eurData.venta;

    if (!usdRate || !eurRate) {
      throw new Error('Could not extract USD or EUR rates from DolarApi response');
    }

    console.log(`Rates fetched - USD: ${usdRate}, EUR: ${eurRate}`);

    // Get all companies with auto-update enabled
    const { data: settings, error: settingsError } = await supabase
      .from('exchange_rate_settings')
      .select('company_id, last_update')
      .eq('auto_update', true);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw new Error(`Error fetching settings: ${settingsError.message}`);
    }

    // If no companies have auto-update enabled, update all active companies
    let companyIds: string[] = [];
    
    if (!settings || settings.length === 0) {
      console.log('No companies with auto-update, fetching all active companies...');
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .eq('active', true);

      if (companiesError) {
        throw new Error(`Error fetching companies: ${companiesError.message}`);
      }

      companyIds = (companies || []).map(c => c.id);
    } else {
      companyIds = settings.map(s => s.company_id);
    }

    console.log(`Updating rates for ${companyIds.length} companies`);

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

        if (usdError) {
          console.error(`Error updating USD for company ${companyId}:`, usdError);
        } else if (currentUsdRate !== usdRate) {
          // Log history only if rate changed
          await supabase.from('exchange_rate_history').insert({
            company_id: companyId,
            currency: 'USD',
            old_rate: currentUsdRate,
            new_rate: usdRate,
            source: 'dolarapi',
          });
          updatedCount++;
        }

        // Update EUR
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

        if (eurError) {
          console.error(`Error updating EUR for company ${companyId}:`, eurError);
        } else if (currentEurRate !== eurRate) {
          // Log history only if rate changed
          await supabase.from('exchange_rate_history').insert({
            company_id: companyId,
            currency: 'EUR',
            old_rate: currentEurRate,
            new_rate: eurRate,
            source: 'dolarapi',
          });
          updatedCount++;
        }

        // Update last_update timestamp in settings
        await supabase
          .from('exchange_rate_settings')
          .upsert({
            company_id: companyId,
            last_update: new Date().toISOString(),
            auto_update: true,
            source: 'dolarapi',
          }, {
            onConflict: 'company_id'
          });

        results.push({
          company_id: companyId,
          success: true,
          usd_rate: usdRate,
          eur_rate: eurRate,
          usd_changed: currentUsdRate !== usdRate,
          eur_changed: currentEurRate !== eurRate,
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
        source: 'dolarapi',
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
    
    // Include more details in error response
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = error?.stack || 'No stack trace';
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error?.toString(),
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
