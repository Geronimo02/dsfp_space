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
  // CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ✅ IMPORTANT: usa SIEMPRE estas env vars (no hardcodear URLs/keys)
    const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json(
        {
          error: "Missing env vars",
          hasUrl: !!supabaseUrl,
          hasService: !!serviceKey,
          hasAnon: !!anonKey,
        },
        500
      );
    }

    // ✅ 1) Cliente ANON para validar el JWT
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ✅ 2) Cliente SERVICE ROLE para DB
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // --- Auth
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) return json({ error: "Authorization header is not Bearer" }, 401);

    const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return json({ error: "Invalid token", details: userErr?.message ?? null }, 401);
    }
    const userId = userRes.user.id;

    // --- Body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { integrationId, type, credentials } = body ?? {};
    if (!integrationId || !type || !credentials) {
      return json({ error: "Missing integrationId/type/credentials" }, 400);
    }

    // --- Load integration
    const { data: integ, error: integErr } = await supabaseAdmin
      .from("integrations")
      .select("id, company_id, integration_type")
      .eq("id", integrationId)
      .single();

// ADD LOGGING HERE
console.log("Integration query result:", { integ, integErr });


    if (integErr || !integ) return json({ error: "Integration not found" }, 404);
    if (integ.integration_type !== type) return json({ error: "Type mismatch" }, 400);

    // --- Check membership
    const { data: cu, error: cuErr } = await supabaseAdmin
      .from("company_users")
      .select("user_id, company_id, active")
      .eq("user_id", userId)
      .eq("company_id", integ.company_id)
      .eq("active", true)
      .maybeSingle();

    if (cuErr) return json({ error: cuErr.message }, 500);
    if (!cu) return json({ error: "Forbidden (not member of company)" }, 403);

    // --- Upsert credentials
    // ⚠️ Necesitás unique constraint en integration_credentials para este onConflict:
    // alter table public.integration_credentials
    // add constraint integration_credentials_company_integration_unique unique (company_id, integration_id);
    const { error: upErr } = await supabaseAdmin
      .from("integration_credentials")
      .upsert(
        { company_id: integ.company_id, integration_id: integ.id, credentials },
        { onConflict: "company_id,integration_id" }
      );

    if (upErr) return json({ error: upErr.message }, 400);

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
