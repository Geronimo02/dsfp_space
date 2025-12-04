// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("https://pjcfncnydhxrlnaowbae.supabase.co")!;
    const SERVICE_ROLE_KEY = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqY2ZuY255ZGh4cmxuYW93YmFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTA0MzkyMCwiZXhwIjoyMDc2NjE5OTIwfQ.bJi0mP3cCYJz-ftjlTEuY5TjpoJsA17hasehPJsXn3Q")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await req.json();
    const { integrationId, secret, namedValues, values, submittedAt, _test } = body ?? {};

    if (!integrationId || !secret) {
      return Response.json({ error: "Missing integrationId/secret" }, { status: 400 });
    }

    // Get expected secret from integration_credentials
    const { data: cred, error: credErr } = await supabaseAdmin
      .from("integration_credentials")
      .select("company_id, credentials")
      .eq("integration_id", integrationId)
      .single();

    if (credErr || !cred) return Response.json({ error: "Credentials not found" }, { status: 404 });

    const expected = cred.credentials?.webhookSecret;
    if (!expected || expected !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (_test) {
      return Response.json({ ok: true, message: "Test received" });
    }

    // Insert into integration_orders as "lead" / "form submission"
    // external_order_id can be something deterministic; here we use timestamp+random
    const externalId = `gforms_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const { error: insErr } = await supabaseAdmin.from("integration_orders").insert({
      integration_id: integrationId,
      company_id: cred.company_id,
      external_order_id: externalId,
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      order_data: { namedValues, values, submittedAt },
      status: "received",
      error_message: null,
      processed_at: null,
    });

    if (insErr) return Response.json({ error: insErr.message }, { status: 400 });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
});
