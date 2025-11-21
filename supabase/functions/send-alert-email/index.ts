import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertEmailRequest {
  companyId: string;
  notificationType: string;
  title: string;
  message: string;
  data?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { companyId, notificationType, title, message, data }: AlertEmailRequest = await req.json();

    // Get users to notify based on preferences
    const { data: usersToNotify, error: usersError } = await supabaseClient
      .rpc('get_users_to_notify', {
        _company_id: companyId,
        _notification_type: notificationType,
        _roles: ['admin', 'manager', 'accountant']
      });

    if (usersError) {
      console.error('Error getting users to notify:', usersError);
      throw usersError;
    }

    // Filter users who have email enabled
    const emailUsers = (usersToNotify?.filter((user: any) => user.email_enabled) || []) as any[];

    if (emailUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users to notify' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get company info for email branding
    const { data: company } = await supabaseClient
      .from('companies')
      .select('name, email')
      .eq('id', companyId)
      .single();

    // Send emails in parallel
    const emailPromises = emailUsers.map((user: any) =>
      resend.emails.send({
        from: `${company?.name || 'Sistema'} <onboarding@resend.dev>`,
        to: [user.email],
        subject: `🔔 Alerta: ${title}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .alert-box { background: white; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .alert-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #dc2626; }
                .alert-message { color: #4b5563; margin-bottom: 15px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔔 Alerta del Sistema</h1>
                  <p>${company?.name || 'Tu Empresa'}</p>
                </div>
                <div class="content">
                  <div class="alert-box">
                    <div class="alert-title">${title}</div>
                    <div class="alert-message">${message}</div>
                    ${data ? `<pre style="background: #f3f4f6; padding: 10px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>` : ''}
                  </div>
                  <p>Hola ${user.full_name || 'Usuario'},</p>
                  <p>Has recibido esta notificación porque está activada en tus preferencias.</p>
                  <a href="${Deno.env.get('SUPABASE_URL')}/inventory-alerts" class="button">
                    Ver en el Sistema
                  </a>
                  <div class="footer">
                    <p>Para dejar de recibir estas notificaciones, actualiza tus preferencias en Configuración > Notificaciones</p>
                    <p>&copy; ${new Date().getFullYear()} ${company?.name || 'Tu Empresa'}. Todos los derechos reservados.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Emails sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: successful,
        failed: failed,
        total: emailUsers.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-alert-email function:', error);
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
