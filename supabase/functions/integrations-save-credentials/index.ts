// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // ✅ Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // ✅ leer secrets correctamente
    const SUPABASE_URL = Deno.env.get("SB_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return Response.json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const { integrationId, type, credentials } = body ?? {};

    if (!integrationId || !type || !credentials) {
      return Response.json({ error: "Missing integrationId/type/credentials" }, { status: 400, headers: corsHeaders });
    }

    const { data: integ, error: integErr } = await supabaseAdmin
      .from("integrations")
      .select("id, company_id, integration_type")
      .eq("id", integrationId)
      .single();

    if (integErr || !integ) {
      return Response.json({ error: "Integration not found" }, { status: 404, headers: corsHeaders });
    }

    if (integ.integration_type !== type) {
      return Response.json({ error: "Type mismatch" }, { status: 400, headers: corsHeaders });
    }

    const { error: upErr } = await supabaseAdmin
      .from("integration_credentials")
      .upsert(
        {
          company_id: integ.company_id,
          integration_id: integ.id,
          credentials,
        },
        { onConflict: "company_id,integration_id" }
      );

    if (upErr) {
      return Response.json({ error: upErr.message }, { status: 400, headers: corsHeaders });
    }

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 500, headers: corsHeaders });
  }
});
