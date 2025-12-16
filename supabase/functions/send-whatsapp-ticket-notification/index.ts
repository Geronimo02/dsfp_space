// @ts-nocheck
// Edge Function para enviar notificaciones de WhatsApp sobre nuevos tickets
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

interface WhatsAppNotificationRequest {
  ticketNumber: string;
  companyName: string;
  subject: string;
  priority: string;
  adminPhoneNumbers: string[]; // Array de números de teléfono de admins
}

serve(async (req: Request) => {
  try {
    const body = await req.json() as WhatsAppNotificationRequest;
    const { ticketNumber, companyName, subject, priority, adminPhoneNumbers } = body;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({ error: "Twilio no configurado" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!adminPhoneNumbers || adminPhoneNumbers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hay números de teléfono para notificar" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const priorityEmoji = {
      urgent: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🟢",
    }[priority] || "🟡";

    const message = `${priorityEmoji} *Nuevo Ticket de Soporte*\n\n` +
      `📌 *Ticket:* ${ticketNumber}\n` +
      `🏢 *Empresa:* ${companyName}\n` +
      `📝 *Asunto:* ${subject}\n` +
      `⚡ *Prioridad:* ${priority}\n\n` +
      `Revisa los detalles en el panel de administración.`;

    const results = [];

    // Enviar a cada número de teléfono
    for (const phoneNumber of adminPhoneNumbers) {
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
              Body: message,
            }).toString(),
          }
        );

        const data = await response.json();
        results.push({
          phoneNumber,
          success: response.ok,
          sid: data.sid,
          error: data.message || null,
        });
      } catch (error) {
        results.push({
          phoneNumber,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ results, message: "Notificaciones procesadas" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
