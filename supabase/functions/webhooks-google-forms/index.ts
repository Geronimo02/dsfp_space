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

function pickFirst(nv: any, key: string) {
  const v = nv?.[key];
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

Deno.serve(async (req) => {
  // ✅ CORS preflight primero
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  console.log("HIT webhooks-google-forms", new Date().toISOString());
  console.log("URL", req.url);

  // ✅ Parse body UNA sola vez
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    console.log("JSON parse error", String(e));
    return json({ error: "Invalid JSON body" }, 400);
  }

  console.log("BODY", body);

  // ✅ Ping sin credenciales (para botón “probar webhook”)
  if (body?._ping === true) {
    return json({ ok: true, message: "Webhook OK!" }, 200);
  }

  // ✅ Env
  const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

  const integrationId = body?.integrationId ?? new URL(req.url).searchParams.get("integrationId");
  const secret = body?.secret;

  const namedValues = body?.namedValues ?? {};
  const values = body?.values ?? [];
  const submittedAt = body?.submittedAt ?? new Date().toISOString();
  const isTest = body?._test === true;

  if (!integrationId) return json({ error: "Missing integrationId" }, 400);
  if (!secret) return json({ error: "Missing secret" }, 400);

  // ✅ Buscar credenciales
  const { data: cred, error: credErr } = await supabaseAdmin
    .from("integration_credentials")
    .select("company_id, credentials")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (credErr) return json({ error: credErr.message }, 500);
  if (!cred) return json({ error: "Credentials not found. Primero hacé 'Guardar integración'." }, 404);

  const expected = (cred as any).credentials?.webhookSecret;
  if (!expected || expected !== secret) return json({ error: "Unauthorized (bad secret)" }, 401);

  // ✅ Test mode (valida secret pero no inserta)
  if (isTest) {
    return json({ ok: true, message: "Test received (secret ok)" }, 200);
  }

  // ✅ Mapear customer_name desde namedValues (fallbacks)
  const customerName =
    pickFirst(namedValues, "Nombre y apellido") ??
    pickFirst(namedValues, "Nombre") ??
    pickFirst(namedValues, "Cliente") ??
    pickFirst(namedValues, "customer_name") ??
    "Sin nombre";

  // ✅ Normal mode: insertar en integration_orders
  const externalId = `gforms_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const { error: insErr } = await supabaseAdmin.from("integration_orders").insert({
    integration_id: integrationId,
    company_id: (cred as any).company_id,
    external_order_id: externalId,
    customer_name: customerName, // ✅ FIX: NOT NULL
    order_data: { namedValues, values, submittedAt },
    status: "pending",
    processed_at: null,
    error_message: null,
  });

  if (insErr) {
    console.log("INSERT ERROR", insErr);
    return json({ error: insErr.message }, 400);
  }

  return json({ ok: true, external_order_id: externalId }, 200);
});
