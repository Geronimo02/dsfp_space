// supabase/functions/mark-intent-ready/index.ts
// Marks signup intent as paid_ready after checkout completes

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { intent_id, stripe_session_id } = await req.json();
    if (!intent_id) return json({ error: "intent_id requerido" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, key);

    const { data: intent, error: intentErr } = await supabase
      .from("signup_intents")
      .select("id, provider, mp_preapproval_id")
      .eq("id", intent_id)
      .single();
    if (intentErr || !intent) return json({ error: intentErr?.message ?? "Intent no encontrado" }, 404);

    if (!intent.mp_preapproval_id) return json({ error: "Preapproval no encontrado" }, 409);
    const { error: updErr } = await supabase
      .from("signup_intents")
      .update({ status: "paid_ready" })
      .eq("id", intent_id);
    if (updErr) return json({ error: updErr.message }, 500);
    return json({ ok: true, provider: "mercadopago" });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
