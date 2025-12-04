/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // si querés más estricto: poné tu dominio de Netlify
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // ✅ 1) Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SB_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const { integrationId, secret, namedValues, values, submittedAt, _test } = body ?? {};

    if (!integrationId || !secret) {
      return new Response(JSON.stringify({ error: "Missing integrationId/secret" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cred, error: credErr } = await supabaseAdmin
      .from("integration_credentials")
      .select("company_id, credentials")
      .eq("integration_id", integrationId)
      .single();

    if (credErr || !cred) {
      return new Response(JSON.stringify({ error: "Credentials not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expected = (cred as any).credentials?.webhookSecret;
    if (!expected || expected !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (_test) {
      return new Response(JSON.stringify({ ok: true, message: "Test received" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalId = `gforms_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const { error: insErr } = await supabaseAdmin.from("integration_orders").insert({
      integration_id: integrationId,
      company_id: cred.company_id,
      external_order_id: externalId,
      order_data: { namedValues, values, submittedAt },
      status: "received",
      processed_at: null,
      error_message: null,
    });

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
