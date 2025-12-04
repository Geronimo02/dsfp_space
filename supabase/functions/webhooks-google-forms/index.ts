/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ✅ Parse body safely
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // ✅ 1) Ping: prueba “endpoint vivo” SIN necesitar credenciales
    // Usalo para tu botón "Probar webhook"
    if (body?._ping === true) {
      return json({ ok: true, message: "webhook alive" }, 200);
    }

    // ✅ Secrets (no usar hardcode)
    const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json(
        {
          error: "Missing env vars",
          hasSB_URL: !!Deno.env.get("SB_URL"),
          hasSB_SERVICE_ROLE_KEY: !!Deno.env.get("SB_SERVICE_ROLE_KEY"),
          hasSUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
          hasSUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        },
        500
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // ✅ Require these for real webhook handling
    const integrationId = body?.integrationId ?? new URL(req.url).searchParams.get("integrationId");
    const secret = body?.secret;

    const namedValues = body?.namedValues ?? {};
    const values = body?.values ?? [];
    const submittedAt = body?.submittedAt ?? new Date().toISOString();
    const isTest = body?._test === true;

    if (!integrationId) return json({ error: "Missing integrationId" }, 400);

    // ✅ 2) Si querés que "_test" sea “test real” (valida secret guardado), entonces pedimos secret
    // Para ping sin secret usá _ping.
    if (!secret) return json({ error: "Missing secret" }, 400);

    // ✅ Buscar credenciales guardadas
    const { data: cred, error: credErr } = await supabaseAdmin
      .from("integration_credentials")
      .select("company_id, credentials")
      .eq("integration_id", integrationId)
      .maybeSingle();

    if (credErr) return json({ error: credErr.message }, 500);
    if (!cred) return json({ error: "Credentials not found. Primero hacé 'Guardar integración'." }, 404);

    const expected = (cred as any).credentials?.webhookSecret;
    if (!expected || expected !== secret) return json({ error: "Unauthorized (bad secret)" }, 401);

    // ✅ 3) Test mode: responde OK sin insertar orden
    if (isTest) {
      return json({ ok: true, message: "Test received (secret ok)" }, 200);
    }

    // ✅ Normal mode: insertar en integration_orders
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

    if (insErr) return json({ error: insErr.message }, 400);

    return json({ ok: true, external_order_id: externalId }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
