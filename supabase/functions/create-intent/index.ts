// supabase/functions/create-intent/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Business constants
const FREE_PLAN_ID = "460d1274-59bc-4c99-a815-c3c1d52d0803";
const BASIC_PLAN_ID = "ea1d515e-5557-4b5c-a0b1-cd5ea9d13fc0";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405);
    }

    const body = await req.json();

    // Support both old and new schemas for backward compatibility
    const email = body.email;
    const full_name = body.full_name;
    const company_name = body.company_name;
    const plan_id = body.plan_id;
    const modules = body.modules;
    
    // New unified schema: payment_provider + payment_method_ref + billing_country
    const payment_provider = body.payment_provider;
    const payment_method_ref = body.payment_method_ref;
    const billing_country = body.billing_country;
    
    // Old schema (still accepted for compatibility): provider + stripe_payment_method_id
    const provider = body.provider || payment_provider;
    const stripe_payment_method_id = body.stripe_payment_method_id || payment_method_ref;

    if (!email || !plan_id || !provider) {
      return json({ error: "email, plan_id y provider son requeridos" }, 400);
    }

    const providerNorm = String(provider).toLowerCase();
    if (!["stripe", "mercadopago", "auto"].includes(providerNorm)) {
      return json({ error: "provider inválido" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Server config error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Determine if user selected free trial
    const isFreeTrial = plan_id === FREE_PLAN_ID;
    
    // Determine which plan to charge NOW (amount_usd)
    const chargePlanId = isFreeTrial ? FREE_PLAN_ID : plan_id;
    
    // Determine which plan to charge AFTER trial
    const billingPlanId = isFreeTrial ? BASIC_PLAN_ID : plan_id;

    // Get the plan to charge NOW (free or paid)
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, price, active")
      .eq("id", chargePlanId)
      .single();

    if (planErr || !plan || !plan.active) {
      return json({ error: "Plan inválido" }, 400);
    }

    const modulesArr: string[] = Array.isArray(modules) ? modules : [];
    const modulesPrice = modulesArr.length * 10;

    // Compute amount to charge NOW (0 for free trial + any modules)
    const amount_usd = round2(Number(plan.price) + modulesPrice);

    // Allow free plans (0 USD) and valid paid plans
    if (!isFinite(amount_usd) || amount_usd < 0) {
      return json({ error: "amount_usd inválido" }, 400);
    }

    // Fixed rate for MercadoPago (replace later with FX)
    const FIXED_USD_ARS = 1000;
    let amount_ars: number | null = null;
    let fx_rate_usd_ars: number | null = null;
    let fx_rate_at: string | null = null;

    if (providerNorm === "mercadopago") {
      fx_rate_usd_ars = FIXED_USD_ARS;
      fx_rate_at = new Date().toISOString();
      amount_ars = round2(amount_usd * FIXED_USD_ARS);
    }

    // Only store stripe_payment_method_id if provider is stripe
    const isStripePayment = providerNorm === "stripe" && stripe_payment_method_id;
    
    const { data: intent, error: insErr } = await supabaseAdmin
      .from("signup_intents")
      .insert({
        email: String(email).trim().toLowerCase(),
        full_name: full_name ?? null,
        company_name: company_name ?? null,

        // store what user picked
        plan_id,

        // store what we'll actually bill (basic if free selected)
        billing_plan_id: billingPlanId,

        modules: modulesArr,
        provider: providerNorm,
        status: isStripePayment ? "paid_ready" : "draft",
        amount_usd,
        amount_ars,
        fx_rate_usd_ars,
        fx_rate_at,
        stripe_payment_method_id: isStripePayment ? stripe_payment_method_id : null,
      })
      .select("id")
      .single();

    if (insErr || !intent) {
      return json({ error: `Insert failed: ${insErr?.message}` }, 500);
    }

    return json({ intent_id: intent.id }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
