/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: url } });
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64urlToBytes(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeJsonB64url(s: string) {
  const bytes = b64urlToBytes(s);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function b64urlEncode(bytes: Uint8Array) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

async function verifyState(secret: string, state: string) {
  const [p, sig] = state.split(".");
  if (!p || !sig) return null;
  const expected = await hmacSha256(secret, p);
  if (expected !== sig) return null;
  return decodeJsonB64url(p);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY");

  const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
  const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");
  const ML_REDIRECT_URL = Deno.env.get("ML_REDIRECT_URL");
  const OAUTH_STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET");
  const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL");

  if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase env vars" }, 500);
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !ML_REDIRECT_URL) return json({ error: "Missing ML env vars" }, 500);
  if (!OAUTH_STATE_SECRET) return json({ error: "Missing OAUTH_STATE_SECRET" }, 500);
  if (!PUBLIC_APP_URL) return json({ error: "Missing PUBLIC_APP_URL" }, 500);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  const okRedirect = `${PUBLIC_APP_URL.replace(/\/$/, "")}/integrations?ml=connected`;
  const failRedirectBase = `${PUBLIC_APP_URL.replace(/\/$/, "")}/integrations?ml=error`;

  if (errorParam) {
    return redirect(`${failRedirectBase}&reason=${encodeURIComponent(errorParam)}&detail=${encodeURIComponent(errorDesc ?? "")}`);
  }
  if (!code || !state) {
    return redirect(`${failRedirectBase}&reason=missing_code_or_state`);
  }

  const payload = await verifyState(OAUTH_STATE_SECRET, state);
  if (!payload?.integrationId || !payload?.companyId) {
    return redirect(`${failRedirectBase}&reason=bad_state`);
  }

  const integrationId = payload.integrationId as string;
  const companyId = payload.companyId as string;

  // Intercambiar code por tokens
  const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      code,
      redirect_uri: ML_REDIRECT_URL,
    }),
  });

  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    return redirect(`${failRedirectBase}&reason=token_exchange_failed&detail=${encodeURIComponent(JSON.stringify(tokenJson))}`);
  }

  const access_token = tokenJson.access_token as string | undefined;
  const refresh_token = tokenJson.refresh_token as string | undefined;
  const user_id = tokenJson.user_id as number | undefined; // vendedor
  const expires_in = tokenJson.expires_in as number | undefined;

  if (!access_token || !refresh_token) {
    return redirect(`${failRedirectBase}&reason=missing_tokens`);
  }

  const expires_at = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  // Guardar credenciales
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  // (opcional) Validar integration existe y coincide con company
  const { data: integ, error: integErr } = await supabaseAdmin
    .from("integrations")
    .select("id, company_id, integration_type")
    .eq("id", integrationId)
    .maybeSingle();

  if (integErr || !integ) return redirect(`${failRedirectBase}&reason=integration_not_found`);
  if (integ.company_id !== companyId) return redirect(`${failRedirectBase}&reason=company_mismatch`);
  if (integ.integration_type !== "mercadolibre") return redirect(`${failRedirectBase}&reason=wrong_type`);

  // Upsert en integration_credentials
  const credentialsToStore = {
    ...(tokenJson ?? {}),
    access_token,
    refresh_token,
    user_id: user_id ?? null,
    expires_at,
    obtained_at: new Date().toISOString(),
    site: "MLA",
  };

  const { error: upErr } = await supabaseAdmin
    .from("integration_credentials")
    .upsert(
      {
        integration_id: integrationId,
        company_id: companyId,
        credentials: { mercadolibre: credentialsToStore },
      },
      { onConflict: "integration_id" }
    );

  if (upErr) {
    return redirect(`${failRedirectBase}&reason=save_credentials_failed`);
  }

  // (opcional) marcar integración activa
  await supabaseAdmin.from("integrations").update({ active: true }).eq("id", integrationId);

  return redirect(okRedirect);
});
