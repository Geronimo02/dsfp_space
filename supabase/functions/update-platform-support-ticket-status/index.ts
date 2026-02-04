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

    console.log("📥 [Edge Function] Request received:", { ticket_id: ticket_id?.slice(0, 8), status });

    if (!ticket_id || !status) {
      return new Response(
        JSON.stringify({ error: "ticket_id y status son requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!serviceRoleKey) {
      console.error("❌ [Edge Function] SUPABASE_SERVICE_ROLE_KEY not configured!");
      return new Response(
        JSON.stringify({ error: "Server configuration error: service role key missing" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Usar SOLO service role key (sin Authorization header del usuario)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey
    );

    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "resolved") updates.resolved_at = new Date().toISOString();
    if (status === "closed") updates.closed_at = new Date().toISOString();

    console.log("📝 [Edge Function] Executing UPDATE:", { ticket_id: ticket_id.slice(0, 8), updates });

    const { error: updateError } = await supabase
      .from("platform_support_tickets")
      .update(updates)
      .eq("id", ticket_id);

    if (updateError) {
      console.error("❌ [Edge Function] UPDATE failed:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("✅ [Edge Function] UPDATE successful, fetching updated ticket...");

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
      console.error("❌ [Edge Function] SELECT failed:", selectError);
      return new Response(
        JSON.stringify({ error: selectError?.message ?? "No se pudo obtener el ticket actualizado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("✅ [Edge Function] Returning ticket:", { 
      ticket_id: fullTicket.id.slice(0, 8), 
      status: fullTicket.status,
      updated_at: fullTicket.updated_at
    });

    return new Response(JSON.stringify({ ticket: fullTicket }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("❌ [Edge Function] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Error interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
