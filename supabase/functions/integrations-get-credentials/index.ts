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
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const integrationId = body?.integrationId;
  if (!integrationId) return json({ error: "Missing integrationId" }, 400);

  const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) return json({ error: "Missing env vars" }, 500);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data, error } = await admin
    .from("integration_credentials")
    .select("credentials")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);

  const creds = (data as any)?.credentials ?? null;

  // Backwards compatible: if webhookSecret present (google_forms), return it
  const webhookSecret = creds?.webhookSecret ?? null;

  // Gmail credentials stored under creds.gmail = { clientId, clientSecret }
  const gmail = creds?.gmail ?? null;
  if (gmail) {
    const clientId = gmail.clientId ?? null;
    const hasClientSecret = Boolean(gmail.clientSecret);
    return json({ ok: true, gmail: { clientId, hasClientSecret } }, 200);
  }

  return json({ ok: true, webhookSecret }, 200);
});
