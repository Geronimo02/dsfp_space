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

    console.log('Checking expiring checks...');
    const { error: expiringChecksError } = await supabaseClient.rpc('check_expiring_checks');
    
    if (expiringChecksError) {
      console.error('Error checking expiring checks:', expiringChecksError);
      throw expiringChecksError;
    }

    // Send email notifications for new notifications
    console.log('Sending email notifications...');
    try {
      // Get recent notifications that haven't been emailed yet
      const { data: recentNotifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('created_at', { ascending: false });

      if (recentNotifications && recentNotifications.length > 0) {
        // Group notifications by type and company
        const notificationGroups = recentNotifications.reduce((acc: any, notif: any) => {
          const key = `${notif.company_id}-${notif.type}`;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(notif);
          return acc;
        }, {} as Record<string, any[]>);

        // Send one email per group
        for (const [key, notifications] of Object.entries(notificationGroups)) {
          const firstNotif = (notifications as any[])[0];
          const emailBody = {
            companyId: firstNotif.company_id,
            notificationType: firstNotif.type,
            title: firstNotif.title,
            message: (notifications as any[]).length > 1 
              ? `${(notifications as any[]).length} nuevas alertas de este tipo`
              : firstNotif.message,
            data: (notifications as any[]).length > 1
              ? { count: (notifications as any[]).length, notifications: (notifications as any[]).map((n: any) => ({ title: n.title, message: n.message })) }
              : firstNotif.data
          };

          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-alert-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify(emailBody)
          }).catch(err => console.error('Error sending email:', err));
        }
      }
    } catch (emailError) {
      console.error('Error sending email notifications:', emailError);
      // Don't throw, we don't want to fail the whole job if emails fail
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
