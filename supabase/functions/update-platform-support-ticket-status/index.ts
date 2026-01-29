// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateStatusRequest {
  ticket_id: string;
  status: "open" | "in_progress" | "pending" | "resolved" | "closed";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as UpdateStatusRequest;
    const { ticket_id, status } = body || {};

    if (!ticket_id || !status) {
      return new Response(
        JSON.stringify({ error: "ticket_id y status son requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey ?? anonKey ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "resolved") updates.resolved_at = new Date().toISOString();
    if (status === "closed") updates.closed_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("platform_support_tickets")
      .update(updates)
      .eq("id", ticket_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: fullTicket, error: selectError } = await supabase
      .from("platform_support_tickets")
      .select(
        `
        *,
        companies!platform_support_tickets_company_id_fkey (
          name,
          email,
          phone,
          whatsapp_number
        )
      `
      )
      .eq("id", ticket_id)
      .single();

    if (selectError || !fullTicket) {
      return new Response(
        JSON.stringify({ error: selectError?.message ?? "No se pudo obtener el ticket actualizado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ ticket: fullTicket }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error?.message ?? "Error interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
