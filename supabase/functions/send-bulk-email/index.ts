import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  email: string;
  name: string;
}

interface BulkEmailRequest {
  recipients: Recipient[];
  subject: string;
  body: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, body }: BulkEmailRequest = await req.json();

    console.log(`Sending bulk emails to ${recipients.length} recipients`);

    // Send emails to all recipients
    const emailPromises = recipients.map(async (recipient) => {
      if (!recipient.email) {
        console.warn(`Skipping recipient without email: ${recipient.name}`);
        return null;
      }

      try {
        const emailResponse = await resend.emails.send({
          from: "Sistema POS <onboarding@resend.dev>",
          to: [recipient.email],
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Hola ${recipient.name},</h2>
              <div style="margin: 20px 0; line-height: 1.6;">
                ${body.replace(/\n/g, '<br>')}
              </div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">
                Este es un mensaje automático de nuestro sistema.
              </p>
            </div>
          `,
        });

        console.log(`Email sent to ${recipient.email}:`, emailResponse);
        return emailResponse;
      } catch (error) {
        console.error(`Error sending email to ${recipient.email}:`, error);
        return null;
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r !== null).length;
    const failureCount = results.length - successCount;

    console.log(`Bulk email completed: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        total: recipients.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

Deno.serve(handler);
