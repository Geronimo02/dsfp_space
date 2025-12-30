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

function b64urlEncode(bytes: Uint8Array) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlEncodeJson(obj: any) {
  return b64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

async function hmacSha256(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

/**
 * State token: base64url(payload).base64url(hmac)
 * payload = { integrationId, companyId, ts, nonce }
 */
async function makeState(secret: string, payload: any) {
  const p = b64urlEncodeJson(payload);
  const sig = await hmacSha256(secret, p);
  return `${p}.${sig}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY");

  const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
  const ML_REDIRECT_URL = Deno.env.get("ML_REDIRECT_URL");
  const OAUTH_STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET");

  if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase env vars" }, 500);
  if (!ML_CLIENT_ID || !ML_REDIRECT_URL) return json({ error: "Missing ML_CLIENT_ID or ML_REDIRECT_URL" }, 500);
  if (!OAUTH_STATE_SECRET) return json({ error: "Missing OAUTH_STATE_SECRET" }, 500);

  // Este endpoint se invoca desde tu frontend con sesión -> usa JWT del user
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const integrationId = body?.integrationId;
  const companyId = body?.companyId; // opcional si querés doble-check

  if (!integrationId) return json({ error: "Missing integrationId" }, 400);

  // Validar que la integración existe (y opcionalmente que es de esa company)
  const q = supabase.from("integrations").select("id, company_id, integration_type").eq("id", integrationId).maybeSingle();
  const { data: integ, error: integErr } = await q;

  if (integErr) return json({ error: integErr.message }, 500);
  if (!integ) return json({ error: "Integration not found" }, 404);
  if (integ.integration_type !== "mercadolibre") return json({ error: "Integration is not mercadolibre" }, 400);
  if (companyId && integ.company_id !== companyId) return json({ error: "Integration/company mismatch" }, 403);

  // Armar state firmado
  const payload = {
    integrationId,
    companyId: integ.company_id,
    ts: Date.now(),
    nonce: crypto.randomUUID(),
  };
  const state = await makeState(OAUTH_STATE_SECRET, payload);

  // URL de autorización (MLA)
  const authUrl = new URL("https://auth.mercadolibre.com.ar/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", ML_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", ML_REDIRECT_URL);
  authUrl.searchParams.set("state", state);

  return json({ url: authUrl.toString() }, 200);
});
