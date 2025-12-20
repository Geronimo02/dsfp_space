// @ts-nocheck
// Edge Function para enviar notificaciones sobre platform_support_tickets
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  ticket_id: string;
  type: "ticket_created" | "message_received" | "status_changed";
  send_email?: boolean;
  send_sms?: boolean;
  send_whatsapp?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json() as NotificationRequest;
    const { ticket_id, type, send_email = true, send_sms = false, send_whatsapp = true } = body;

    console.log(`📨 Procesando notificación: ticket=${ticket_id}, type=${type}`);

    // Obtener información del ticket de PLATFORM
    const { data: ticket, error: ticketError } = await supabase
      .from("platform_support_tickets")
      .select(`
        *,
        companies!company_id(name, email, phone, whatsapp_number, whatsapp_enabled),
        platform_support_messages(*)
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error("❌ Ticket no encontrado:", ticketError);
      throw new Error("Ticket no encontrado");
    }

    const company = ticket.companies;
    const companyEmail = company?.email;
    const companyPhone = company?.whatsapp_number || company?.phone;
    const whatsappEnabled = company?.whatsapp_enabled;

    if (!companyEmail && !companyPhone) {
      console.warn("⚠️ No hay email ni teléfono para la empresa");
      return new Response(
        JSON.stringify({ message: "No hay contacto disponible" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build priority emoji and SLA info
    const priorityEmojis: Record<string, string> = {
      low: "🟢",
      medium: "🟡",
      high: "🟠",
      urgent: "🔴",
    };
    const priorityEmoji = priorityEmojis[ticket.priority] || "🟡";

    let subject = "";
    let htmlContent = "";
    let smsContent = "";
    let whatsappContent = "";

    // Preparar contenido según el tipo
    if (type === "ticket_created") {
      subject = `Tu Ticket ${ticket.ticket_number} - ${ticket.subject}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">🎫 Nuevo Ticket de Soporte</h2>
          <p>Hola ${company.name},</p>
          <p>Hemos recibido tu consulta. Un miembro de nuestro equipo se pondrá en contacto contigo pronto.</p>
          
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <p style="margin: 8px 0;"><strong>📌 Número de Ticket:</strong> ${ticket.ticket_number}</p>
            <p style="margin: 8px 0;"><strong>📝 Asunto:</strong> ${ticket.subject}</p>
            <p style="margin: 8px 0;"><strong>📄 Descripción:</strong></p>
            <p style="margin: 8px 0; padding-left: 10px; border-left: 2px solid #ddd;">${ticket.description}</p>
            <p style="margin: 8px 0;"><strong>${priorityEmoji} Prioridad:</strong> ${ticket.priority.toUpperCase()}</p>
            <p style="margin: 8px 0;"><strong>⏱️ SLA Respuesta:</strong> ${ticket.sla_response_hours || 24} horas</p>
            <p style="margin: 8px 0;"><strong>⏱️ SLA Resolución:</strong> ${ticket.sla_resolution_hours || 72} horas</p>
            ${ticket.auto_priority_reason ? `<p style="margin: 8px 0; color: #666;"><em>👑 ${ticket.auto_priority_reason}</em></p>` : ''}
          </div>
          
          <p>Para cualquier consulta adicional, responde a este email citando el número de ticket.</p>
          <p>Saludos,<br><strong>DSFP Support Team</strong></p>
        </div>
      `;
      smsContent = `Tu ticket ${ticket.ticket_number} ha sido creado. Prioridad: ${ticket.priority}. Te responderemos en ${ticket.sla_response_hours || 24}h.`;
      whatsappContent = `🎫 *Nuevo Ticket de Soporte*\n\n📌 *Ticket:* ${ticket.ticket_number}\n📝 *Asunto:* ${ticket.subject}\n${priorityEmoji} *Prioridad:* ${ticket.priority}\n⏱️ *Respuesta en:* ${ticket.sla_response_hours || 24}h\n\n✅ Te notificaremos cuando tengamos una respuesta.`;
    } else if (type === "message_received") {
      const messages = ticket.platform_support_messages || [];
      const lastMessage = messages[messages.length - 1];

      subject = `📩 Respuesta a tu Ticket ${ticket.ticket_number}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">💬 Nueva respuesta en tu Ticket</h2>
          <p>Hola ${company.name},</p>
          <p>Hemos respondido a tu ticket de soporte.</p>
          
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981;">
            <p style="margin: 8px 0;"><strong>📌 Ticket:</strong> ${ticket.ticket_number}</p>
            <p style="margin: 8px 0;"><strong>📝 Asunto:</strong> ${ticket.subject}</p>
            <p style="margin: 8px 0;"><strong>💬 Respuesta:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
              ${lastMessage?.message || "Ver tu ticket para más detalles"}
            </div>
          </div>
          
          <p>Accede a tu cuenta para ver todos los detalles y responder.</p>
          <p>Saludos,<br><strong>DSFP Support Team</strong></p>
        </div>
      `;
      smsContent = `Hemos respondido a tu ticket ${ticket.ticket_number}. Accede a tu cuenta para ver la respuesta.`;
      whatsappContent = `💬 *Nueva Respuesta en Ticket*\n\n📌 *Ticket:* ${ticket.ticket_number}\n📝 *Asunto:* ${ticket.subject}\n\n*Respuesta:*\n${lastMessage?.message?.substring(0, 500) || "Ver detalles en la plataforma"}\n\n🔗 Accede a tu cuenta para responder.`;
    } else if (type === "status_changed") {
      const statusText: Record<string, string> = {
        open: "🔴 Abierto",
        in_progress: "🔵 En Progreso",
        pending: "🟡 Pendiente",
        resolved: "🟢 Resuelto",
        closed: "⚫ Cerrado",
      };
      const status = statusText[ticket.status] || ticket.status;

      subject = `📋 Actualización: Tu Ticket ${ticket.ticket_number} - ${status}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">📋 Actualización de tu Ticket</h2>
          <p>Hola ${company.name},</p>
          <p>El estado de tu ticket ha cambiado.</p>
          
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 8px 0;"><strong>📌 Ticket:</strong> ${ticket.ticket_number}</p>
            <p style="margin: 8px 0;"><strong>📝 Asunto:</strong> ${ticket.subject}</p>
            <p style="margin: 8px 0;"><strong>🔄 Nuevo Estado:</strong> <span style="font-size: 1.2em;">${status}</span></p>
            ${ticket.waiting_for_customer ? '<p style="margin: 8px 0; color: #f59e0b;"><strong>⏳ Esperando información de tu parte</strong></p>' : ''}
          </div>
          
          <p>Accede a tu cuenta para ver más detalles.</p>
          <p>Saludos,<br><strong>DSFP Support Team</strong></p>
        </div>
      `;
      smsContent = `Tu ticket ${ticket.ticket_number} ahora está: ${ticket.status}${ticket.waiting_for_customer ? ' (esperando tu respuesta)' : ''}`;
      whatsappContent = `📋 *Actualización de Ticket*\n\n📌 *Ticket:* ${ticket.ticket_number}\n🔄 *Nuevo Estado:* ${status}${ticket.waiting_for_customer ? '\n\n⏳ *Estamos esperando información de tu parte.*' : ''}\n\n🔗 Accede a tu cuenta para más detalles.`;
    }

    const results = {
      email_sent: false,
      sms_sent: false,
      whatsapp_sent: false,
      errors: [] as string[],
    };

    // Enviar Email
    if (send_email && companyEmail && RESEND_API_KEY) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        const response = await resend.emails.send({
          from: "soporte@dsfp.app",
          to: companyEmail,
          subject: subject,
          html: htmlContent,
        });

        if (response.data?.id) {
          console.log("✅ Email enviado:", response.data.id);
          results.email_sent = true;
        } else {
          results.errors.push("Error al enviar email");
        }
      } catch (error: any) {
        console.error("❌ Error enviando email:", error);
        results.errors.push(`Email error: ${error.message}`);
      }
    }

    // Enviar WhatsApp
    if ((send_whatsapp || send_sms) && companyPhone && whatsappEnabled && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        
        // Format phone number for WhatsApp
        let phoneNumber = companyPhone.replace(/\D/g, '');
        if (!phoneNumber.startsWith('+')) {
          phoneNumber = `+${phoneNumber}`;
        }

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
              Body: whatsappContent,
            }).toString(),
          }
        );

        const data = await response.json();
        if (response.ok) {
          console.log("✅ WhatsApp enviado:", data.sid);
          results.whatsapp_sent = true;
        } else {
          console.error("❌ WhatsApp error:", data);
          results.errors.push(`WhatsApp error: ${data.message}`);
        }
      } catch (error: any) {
        console.error("❌ Error enviando WhatsApp:", error);
        results.errors.push(`WhatsApp error: ${error.message}`);
      }
    }

    console.log("📊 Resultados:", results);
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
