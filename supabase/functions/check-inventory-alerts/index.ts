import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking low stock alerts...');
    const { error: lowStockError } = await supabaseClient.rpc('check_low_stock_alerts');
    
    if (lowStockError) {
      console.error('Error checking low stock:', lowStockError);
      throw lowStockError;
    }

    console.log('Checking expiring products...');
    const { error: expiringError } = await supabaseClient.rpc('check_expiring_products');
    
    if (expiringError) {
      console.error('Error checking expiring products:', expiringError);
      throw expiringError;
    }

    console.log('Checking inactive customers...');
    const { error: inactiveCustomersError } = await supabaseClient.rpc('check_inactive_customers');
    
    if (inactiveCustomersError) {
      console.error('Error checking inactive customers:', inactiveCustomersError);
      throw inactiveCustomersError;
    }

    console.log('Checking overdue invoices...');
    const { error: overdueInvoicesError } = await supabaseClient.rpc('check_overdue_invoices');
    
    if (overdueInvoicesError) {
      console.error('Error checking overdue invoices:', overdueInvoicesError);
      throw overdueInvoicesError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Inventory alerts checked successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-inventory-alerts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
