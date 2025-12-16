// @ts-nocheck - Deno Edge Function (TypeScript errors are expected)
// Edge Function para enviar notificaciones de soporte al cliente
// Envia por email y/o SMS según configuración de la empresa
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

interface NotificationRequest {
  ticket_id: string;
  message_id?: string;
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
    const { ticket_id, message_id, type, send_email = true, send_sms = false } = body;

    // Obtener información del ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("customer_support_tickets")
      .select(`
        *,
        customers!customer_id(name, email, phone),
        companies(name, email)
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new Error("Ticket no encontrado");
    }

    const customer = ticket.customers;
    const company = ticket.companies;

    // Preparar contenido según el tipo
    let subject = "";
    let htmlContent = "";
    let smsContent = "";

    if (type === "ticket_created") {
      subject = `Ticket ${ticket.ticket_number} - ${ticket.subject}`;
      htmlContent = `
        <h2>Nuevo Ticket de Soporte</h2>
        <p>Estimado/a ${customer.name},</p>
        <p>Hemos recibido su consulta. Un miembro de nuestro equipo se pondrá en contacto con usted en breve.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>Número de Ticket:</strong> ${ticket.ticket_number}</p>
          <p><strong>Asunto:</strong> ${ticket.subject}</p>
          <p><strong>Descripción:</strong></p>
          <p>${ticket.description}</p>
          <p><strong>Prioridad:</strong> ${ticket.priority}</p>
          <p><strong>Estado:</strong> ${ticket.status}</p>
        </div>
        <p>Para cualquier consulta adicional, responda a este email citando el número de ticket.</p>
        <p>Saludos,<br>${company.name}</p>
      `;
      smsContent = `${company.name}: Su ticket ${ticket.ticket_number} ha sido creado. Le responderemos pronto.`;
    } else if (type === "message_received" && message_id) {
      // Obtener el mensaje
      const { data: message } = await supabase
        .from("customer_support_messages")
        .select("*")
        .eq("id", message_id)
        .single();

      if (message) {
        subject = `Re: ${ticket.ticket_number} - ${ticket.subject}`;
        htmlContent = `
          <h2>Nueva Respuesta a su Ticket</h2>
          <p>Estimado/a ${customer.name},</p>
          <p>Hemos respondido a su ticket de soporte:</p>
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <p><strong>Ticket:</strong> ${ticket.ticket_number}</p>
            <p><strong>Respuesta:</strong></p>
            <p>${message.message}</p>
          </div>
          <p>Si necesita información adicional, responda a este email.</p>
          <p>Saludos,<br>${company.name}</p>
        `;
        smsContent = `${company.name}: Nueva respuesta en ticket ${ticket.ticket_number}. Revise su email para más detalles.`;
      }
    } else if (type === "status_changed") {
      subject = `Actualización: ${ticket.ticket_number} - ${ticket.subject}`;
      const statusText: Record<string, string> = {
        open: "Abierto",
        in_progress: "En Progreso",
        pending: "Pendiente",
        resolved: "Resuelto",
        closed: "Cerrado"
      };
      const statusLabel = statusText[ticket.status] || ticket.status;

      htmlContent = `
        <h2>Actualización de Ticket</h2>
        <p>Estimado/a ${customer.name},</p>
        <p>El estado de su ticket ha cambiado:</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>Ticket:</strong> ${ticket.ticket_number}</p>
          <p><strong>Nuevo Estado:</strong> ${statusLabel}</p>
        </div>
        <p>Saludos,<br>${company.name}</p>
      `;
      smsContent = `${company.name}: Ticket ${ticket.ticket_number} actualizado a: ${statusLabel}`;
    }

    const results = {
      email_sent: false,
      sms_sent: false,
      errors: [] as string[]
    };

    // Enviar Email
    if (send_email && customer.email && RESEND_API_KEY) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: company.email || "soporte@dsfp.app",
            to: customer.email,
            subject: subject,
            html: htmlContent,
            reply_to: company.email || "soporte@dsfp.app",
          }),
        });

        if (emailResponse.ok) {
          results.email_sent = true;
          
          // Registrar en historial de emails
          await supabase.from("customer_support_emails").insert({
            company_id: ticket.company_id,
            ticket_id: ticket.id,
            customer_id: ticket.customer_id,
            email_type: type === "ticket_created" ? "outgoing" : "outgoing",
            subject: subject,
            body: htmlContent,
            status: "sent",
            sent_at: new Date().toISOString()
          });
        } else {
          const error = await emailResponse.text();
          results.errors.push(`Error email: ${error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Error email: ${errorMsg}`);
      }
    }

    // Enviar SMS (Twilio)
    if (send_sms && customer.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const smsResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({
              To: customer.phone,
              From: TWILIO_PHONE_NUMBER || "",
              Body: smsContent,
            }),
          }
        );

        if (smsResponse.ok) {
          results.sms_sent = true;
        } else {
          const error = await smsResponse.text();
          results.errors.push(`Error SMS: ${error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Error SMS: ${errorMsg}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
