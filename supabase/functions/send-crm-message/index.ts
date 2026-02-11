// @ts-nocheck - Deno Edge Function (TypeScript errors are expected)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CRMMessageRequest {
  log_id: string;
  channel: "email" | "whatsapp";
  recipient: string;
  subject?: string | null;
  body: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const payload = (await req.json()) as CRMMessageRequest;
    const { log_id, channel, recipient, subject, body } = payload;

    if (!log_id || !channel || !recipient || !body) {
      return new Response(JSON.stringify({ error: "Parámetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel === "email") {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        await supabase.from("crm_message_logs").update({ status: "failed", error: "RESEND_API_KEY no configurado" }).eq("id", log_id);
        return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurado" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resend = new Resend(RESEND_API_KEY);
      const html = `<p>${body}</p>`;
      const response = await resend.emails.send({
        from: "Sistema Contable <onboarding@resend.dev>",
        to: [recipient],
        subject: subject ?? "Notificación CRM",
        html,
      });

      await supabase
        .from("crm_message_logs")
        .update({
          status: "sent",
          provider_message_id: response.data?.id ?? null,
          error: null,
        })
        .eq("id", log_id);

      return new Response(JSON.stringify({ success: true, provider_id: response.data?.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel === "whatsapp") {
      const { data: logRow } = await supabase
        .from("crm_message_logs")
        .select("company_id")
        .eq("id", log_id)
        .single();

      const companyId = logRow?.company_id as string | undefined;
      if (!companyId) {
        await supabase.from("crm_message_logs").update({ status: "failed", error: "Empresa no encontrada" }).eq("id", log_id);
        return new Response(JSON.stringify({ error: "Empresa no encontrada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: creds } = await supabase
        .from("crm_whatsapp_credentials")
        .select("account_sid, auth_token, phone_number")
        .eq("company_id", companyId)
        .single();

      const TWILIO_ACCOUNT_SID = creds?.account_sid;
      const TWILIO_AUTH_TOKEN = creds?.auth_token;
      const TWILIO_PHONE_NUMBER = creds?.phone_number;

      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        await supabase
          .from("crm_message_logs")
          .update({ status: "failed", error: "Credenciales Twilio no configuradas" })
          .eq("id", log_id);
        return new Response(JSON.stringify({ error: "Credenciales Twilio no configuradas" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const bodyParams = new URLSearchParams();
      bodyParams.set("From", `whatsapp:${TWILIO_PHONE_NUMBER}`);
      bodyParams.set("To", recipient.startsWith("whatsapp:") ? recipient : `whatsapp:${recipient}`);
      bodyParams.set("Body", body);

      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        }
      );

      const twilioData = await twilioResponse.json();
      if (!twilioResponse.ok) {
        await supabase.from("crm_message_logs").update({
          status: "failed",
          error: twilioData?.message ?? "Error al enviar WhatsApp",
        }).eq("id", log_id);
        return new Response(JSON.stringify({ error: twilioData?.message ?? "Error al enviar WhatsApp" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("crm_message_logs")
        .update({
          status: "sent",
          provider_message_id: twilioData?.sid ?? null,
          error: null,
        })
        .eq("id", log_id);

      return new Response(JSON.stringify({ success: true, provider_id: twilioData?.sid }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Canal inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Error inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
