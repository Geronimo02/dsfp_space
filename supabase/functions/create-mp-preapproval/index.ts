// supabase/functions/create-mp-preapproval/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { company_id } = await req.json();
    if (!company_id) return json({ error: "company_id requerido" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!;
    const supabase = createClient(url, key);

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("id, company_id, plan_id, trial_ends_at, signup_intents!inner(email), subscription_plans!inner(name, price)")
      .eq("company_id", company_id)
      .maybeSingle();
    if (subErr || !sub) return json({ error: subErr?.message ?? "Suscripción no encontrada" }, 404);

    const fx = Number(Deno.env.get("DEFAULT_USD_ARS_RATE") ?? "1000");
    const amount_ars = Math.round(Number(sub.subscription_plans?.price ?? 0) * fx);
    const start_date = sub.trial_ends_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const body = {
      reason: `Suscripción ${sub.subscription_plans?.name}`,
      payer_email: sub.signup_intents?.email,
      back_url: `${url}/functions/v1/mercadopago-webhook`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount_ars,
        currency_id: "ARS",
        start_date,
      },
    };

    const resp = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { Authorization: `Bearer ${mpToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const jsonResp = await resp.json();
    if (!resp.ok) return json({ error: jsonResp?.message ?? "MercadoPago error" }, 502);

    await supabase.from("subscriptions").update({ mp_preapproval_id: jsonResp.id }).eq("id", sub.id);
    return json({ redirect_url: jsonResp.init_point ?? jsonResp.sandbox_init_point ?? null, preapproval_id: jsonResp.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
