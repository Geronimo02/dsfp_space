import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  console.log(`[create-intent] ${req.method} started`);

  try {
    if (req.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405);
    }

    const body = await req.json();
    console.log("[create-intent] Body:", body);

    const { email, full_name, company_name, plan_id, modules, provider } = body;

    if (!email || !plan_id || !provider) {
      return json({ error: "email, plan_id y provider son requeridos" }, 400);
    }

    const providerNorm = String(provider).toLowerCase();
    if (!["stripe", "mercadopago"].includes(providerNorm)) {
      return json({ error: "provider inválido" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Server config error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    console.log("[create-intent] Validating plan");
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, price, active")
      .eq("id", plan_id)
      .single();

    if (planErr || !plan || !plan.active) {
      console.log("[create-intent] Plan error:", planErr);
      return json({ error: "Plan inválido" }, 400);
    }

    const modulesArr: string[] = Array.isArray(modules) ? modules : [];
    const modulesPrice = modulesArr.length * 10;
    const amount_usd = round2(Number(plan.price) + modulesPrice);

    if (!isFinite(amount_usd) || amount_usd <= 0) {
      return json({ error: "amount_usd inválido" }, 400);
    }

    // Use fixed rate for MercadoPago (no external API call)
    const FIXED_USD_ARS = 1000;
    let amount_ars: number | null = null;
    let fx_rate_usd_ars: number | null = null;
    let fx_rate_at: string | null = null;

    if (providerNorm === "mercadopago") {
      fx_rate_usd_ars = FIXED_USD_ARS;
      fx_rate_at = new Date().toISOString();
      amount_ars = round2(amount_usd * FIXED_USD_ARS);
      console.log(`[create-intent] MercadoPago: ${amount_usd} USD = ${amount_ars} ARS`);
    }

    console.log("[create-intent] Inserting intent");
    const { data: intent, error: insErr } = await supabaseAdmin
      .from("signup_intents")
      .insert({
        email: String(email).trim().toLowerCase(),
        full_name: full_name ?? null,
        company_name: company_name ?? null,
        plan_id,
        modules: modulesArr,
        provider: providerNorm,
        status: "draft",
        amount_usd,
        amount_ars,
        fx_rate_usd_ars,
        fx_rate_at,
      })
      .select("id")
      .single();

    if (insErr || !intent) {
      console.error("[create-intent] Insert error:", insErr);
      return json({ error: `Insert failed: ${insErr?.message}` }, 500);
    }

    console.log("[create-intent] Success:", intent.id);
    return json({ intent_id: intent.id }, 200);
  } catch (e) {
    console.error("[create-intent] Error:", e);
    return json({ error: String(e) }, 500);
  }
};
