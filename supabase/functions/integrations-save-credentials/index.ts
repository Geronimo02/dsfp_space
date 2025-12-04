// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const { integrationId, type, credentials } = body ?? {};

    if (!integrationId || !type || !credentials) {
      return Response.json({ error: "Missing integrationId/type/credentials" }, { status: 400 });
    }

    // Fetch company_id from integrations to avoid mismatch
    const { data: integ, error: integErr } = await supabaseAdmin
      .from("integrations")
      .select("id, company_id, integration_type")
      .eq("id", integrationId)
      .single();

    if (integErr || !integ) {
      return Response.json({ error: "Integration not found" }, { status: 404 });
    }

    if (integ.integration_type !== type) {
      return Response.json({ error: "Type mismatch" }, { status: 400 });
    }

    // Upsert into integration_credentials
    // Adjust conflict target depending on your PK/unique:
    // If your PK is (company_id, integration_id) -> use onConflict "company_id,integration_id"
    const { error: upErr } = await supabaseAdmin
      .from("integration_credentials")
      .upsert(
        {
          company_id: integ.company_id,
          integration_id: integrationId,
          credentials,
        },
        { onConflict: "company_id,integration_id" }
      );

    if (upErr) {
      return Response.json({ error: upErr.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
});
