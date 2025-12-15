// @ts-nocheck
// Edge Function para enviar notificaciones sobre platform_support_tickets
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

interface NotificationRequest {
  ticket_id: string;
  type: "ticket_created" | "message_received" | "status_changed";
  send_email?: boolean;
  send_sms?: boolean;
}

serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json() as NotificationRequest;
    const { ticket_id, type, send_email = true, send_sms = false } = body;

    console.log(`📨 Procesando notificación: ticket=${ticket_id}, type=${type}`);

    // Obtener información del ticket de PLATFORM
    const { data: ticket, error: ticketError } = await supabase
      .from("platform_support_tickets")
      .select(`
        *,
        companies!company_id(name, email, phone),
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
    const companyPhone = company?.phone;

    if (!companyEmail && !companyPhone) {
      console.warn("⚠️ No hay email ni teléfono para la empresa");
      return new Response(
        JSON.stringify({ message: "No hay contacto disponible" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let subject = "";
    let htmlContent = "";
    let smsContent = "";

    // Preparar contenido según el tipo
    if (type === "ticket_created") {
      subject = `Tu Ticket ${ticket.ticket_number} - ${ticket.subject}`;
      htmlContent = `
        <h2>Nuevo Ticket de Soporte</h2>
        <p>Hola ${company.name},</p>
        <p>Hemos recibido tu consulta. Un miembro de nuestro equipo se pondrá en contacto contigo pronto.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>📌 Número de Ticket:</strong> ${ticket.ticket_number}</p>
          <p><strong>📝 Asunto:</strong> ${ticket.subject}</p>
          <p><strong>📄 Descripción:</strong></p>
          <p>${ticket.description}</p>
          <p><strong>⚡ Prioridad:</strong> ${ticket.priority}</p>
          <p><strong>🔄 Estado:</strong> ${ticket.status}</p>
        </div>
        <p>Para cualquier consulta adicional, responde a este email citando el número de ticket.</p>
        <p>Saludos,<br><strong>DSFP Support Team</strong></p>
      `;
      smsContent = `Tu ticket ${ticket.ticket_number} ha sido creado. Le responderemos pronto.`;
    } else if (type === "message_received") {
      // Obtener el último mensaje
      const messages = ticket.platform_support_messages || [];
      const lastMessage = messages[messages.length - 1];

      subject = `Respuesta a tu Ticket ${ticket.ticket_number}`;
      htmlContent = `
        <h2>Nueva respuesta en tu Ticket</h2>
        <p>Hola ${company.name},</p>
        <p>Hemos respondido a tu ticket de soporte.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>📌 Ticket:</strong> ${ticket.ticket_number}</p>
          <p><strong>📝 Asunto:</strong> ${ticket.subject}</p>
          <p><strong>💬 Respuesta:</strong></p>
          <p>${lastMessage?.message || "Ver tu ticket para más detalles"}</p>
        </div>
        <p>Accede a tu cuenta para ver todos los detalles y responder.</p>
        <p>Saludos,<br><strong>DSFP Support Team</strong></p>
      `;
      smsContent = `Hemos respondido a tu ticket ${ticket.ticket_number}. Accede a tu cuenta para ver la respuesta.`;
    } else if (type === "status_changed") {
      const statusText = {
        open: "Abierto",
        in_progress: "En Progreso",
        pending: "Pendiente",
        resolved: "Resuelto",
        closed: "Cerrado",
      }[ticket.status] || ticket.status;

      subject = `Actualización: Tu Ticket ${ticket.ticket_number} - ${statusText}`;
      htmlContent = `
        <h2>Actualización de tu Ticket</h2>
        <p>Hola ${company.name},</p>
        <p>El estado de tu ticket ha cambiado.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>📌 Ticket:</strong> ${ticket.ticket_number}</p>
          <p><strong>📝 Asunto:</strong> ${ticket.subject}</p>
          <p><strong>🔄 Nuevo Estado:</strong> <strong>${statusText}</strong></p>
        </div>
        <p>Accede a tu cuenta para ver más detalles.</p>
        <p>Saludos,<br><strong>DSFP Support Team</strong></p>
      `;
      smsContent = `Tu ticket ${ticket.ticket_number} ahora está: ${statusText}`;
    }

    const results = {
      email_sent: false,
      sms_sent: false,
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

    // Enviar SMS/WhatsApp
    if (send_sms && companyPhone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
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
              To: `whatsapp:${companyPhone}`,
              Body: smsContent,
            }).toString(),
          }
        );

        const data = await response.json();
        if (response.ok) {
          console.log("✅ WhatsApp enviado:", data.sid);
          results.sms_sent = true;
        } else {
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
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
