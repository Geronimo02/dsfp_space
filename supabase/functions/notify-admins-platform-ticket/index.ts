// @ts-nocheck
// Edge Function para notificar a admins cuando se crea un nuevo ticket de soporte
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TicketNotificationRequest {
  ticketId: string;
  ticketNumber: string;
  companyId: string;
  companyName: string;
  subject: string;
  description: string;
  priority: string;
  category: string;
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📨 Procesando notificación a admins...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json() as TicketNotificationRequest;
    const {
      ticketId,
      ticketNumber,
      companyName,
      subject,
      description,
      priority,
      category,
      sendEmail = true,
      sendWhatsApp = true,
    } = body;

    // Obtener admins activos
    const { data: adminRows, error: adminsError } = await supabase
      .from("platform_admins")
      .select("user_id, email")
      .eq("active", true);

    if (adminsError) {
      throw new Error(`Error al obtener administradores: ${adminsError.message}`);
    }

    const adminIds = (adminRows ?? []).map((admin: any) => admin.user_id);
    let adminProfiles: any[] = [];

    if (adminIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, notification_email, notification_whatsapp, whatsapp_number")
        .in("id", adminIds);

      if (profilesError) {
        console.warn("No se pudieron obtener preferencias de admins:", profilesError.message);
      } else {
        adminProfiles = profilesData ?? [];
      }
    }

    const profilesById = new Map(
      adminProfiles.map((profile: any) => [profile.id, profile])
    );

    const admins = (adminRows ?? []).map((admin: any) => {
      const profile = profilesById.get(admin.user_id);
      return {
        user_id: admin.user_id,
        email: admin.email,
        notification_email: profile?.notification_email ?? true,
        notification_whatsapp: profile?.notification_whatsapp ?? false,
        whatsapp_number: profile?.whatsapp_number ?? null,
      };
    });

    const results = {
      email_sent: 0,
      whatsapp_sent: 0,
      errors: [],
    };

    // 1. Enviar emails
    if (sendEmail && RESEND_API_KEY && admins.length > 0) {
      const resend = new Resend(RESEND_API_KEY);
      const emailAddresses = admins
        .filter((a: any) => a.email && a.notification_email)
        .map((a: any) => a.email);

      if (emailAddresses.length > 0) {
        try {
          const priorityColor = {
            urgent: "#dc2626",
            high: "#ea580c",
            medium: "#eab308",
            low: "#22c55e",
          }[priority] || "#eab308";

          const emailBody = `
            <h2>Nuevo Ticket de Soporte</h2>
            <p><strong>Empresa:</strong> ${companyName}</p>
            <p><strong>Número de Ticket:</strong> <code>${ticketNumber}</code></p>
            <p><strong>Asunto:</strong> ${subject}</p>
            <p><strong>Descripción:</strong></p>
            <p>${description}</p>
            <p><strong>Categoría:</strong> ${category}</p>
            <p><strong style="color: ${priorityColor};">Prioridad:</strong> ${priority}</p>
            <p><a href="${Deno.env.get('ADMIN_PANEL_URL') || 'https://app.example.com'}/admin?tab=platform-support">Ver ticket en el panel</a></p>
          `;

          const response = await resend.emails.send({
            from: "soporte@dsfp.app",
            to: emailAddresses,
            subject: `[${priority.toUpperCase()}] Nuevo Ticket: ${companyName}`,
            html: emailBody,
          });

          if (response.data?.id) {
            results.email_sent = emailAddresses.length;
          } else {
            results.errors.push("Error al enviar emails");
          }
        } catch (error) {
          results.errors.push(`Email error: ${error.message}`);
        }
      }
    }

    // 2. Enviar WhatsApp
    if (
      sendWhatsApp &&
      TWILIO_ACCOUNT_SID &&
      TWILIO_AUTH_TOKEN &&
      TWILIO_PHONE_NUMBER
    ) {
      const phoneNumbers = admins
        .filter((a: any) => a.whatsapp_number && a.notification_whatsapp)
        .map((a: any) => a.whatsapp_number);

      const priorityEmoji = {
        urgent: "🔴",
        high: "🟠",
        medium: "🟡",
        low: "🟢",
      }[priority] || "🟡";

      const whatsappMessage = `${priorityEmoji} *NUEVO TICKET DE SOPORTE*\n\n` +
        `🏢 *Empresa:* ${companyName}\n` +
        `📌 *Ticket:* ${ticketNumber}\n` +
        `📝 *Asunto:* ${subject}\n` +
        `⚡ *Prioridad:* ${priority}\n\n` +
        `⏱️ Revisa los detalles en el panel de administración.`;

      for (const phoneNumber of phoneNumbers) {
        try {
          const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                From: `whatsapp:${TWILIO_PHONE_NUMBER}`,
                To: `whatsapp:${phoneNumber}`,
                Body: whatsappMessage,
              }).toString(),
            }
          );

          if (response.ok) {
            results.whatsapp_sent++;
          } else {
            results.errors.push(`WhatsApp error for ${phoneNumber}`);
          }
        } catch (error) {
          results.errors.push(`WhatsApp error: ${error.message}`);
        }
      }
    }

    console.log("📊 Resultados:", results);
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
