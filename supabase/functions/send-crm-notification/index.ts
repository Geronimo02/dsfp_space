// @ts-nocheck - Deno Edge Function (TypeScript errors are expected)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  email: string;
  name?: string;
}

interface CRMNotificationRequest {
  recipients: Recipient[];
  subject: string;
  message: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY no configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recipients, subject, message } = (await req.json()) as CRMNotificationRequest;
    if (!recipients?.length || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Parámetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(RESEND_API_KEY);
    const to = recipients.map((r) => r.email);

    const html = `
      <h2>${subject}</h2>
      <p>${message}</p>
      <p style="color:#6b7280;font-size:12px">Notificación generada por el CRM.</p>
    `;

    const emailResponse = await resend.emails.send({
      from: "Sistema Contable <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error?.message || "Error inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
