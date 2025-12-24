// supabase/functions/start-checkout/index.ts
// Inline CORS to avoid cold-start issues
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { corsHeaders as sharedCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

type Provider = "stripe" | "mercadopago";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Business constants
const FREE_PLAN_ID = "460d1274-59bc-4c99-a815-c3c1d52d0803";
const BASIC_PLAN_ID = "ea1d515e-5557-4b5c-a0b1-cd5ea9d13fc0";
const FREE_TRIAL_DAYS = 7;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { intent_id, success_url, cancel_url } = await req.json();

    if (!intent_id || !success_url || !cancel_url) {
      return json({ error: "intent_id, success_url y cancel_url son requeridos" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: intent, error: intentErr } = await supabaseAdmin
      .from("signup_intents")
      .select("*")
      .eq("id", intent_id)
      .single();

    if (intentErr || !intent) {
      return json({ error: "Signup intent no encontrado" }, 404);
    }

    // Decide provider automatically if requested or missing
    const cfCountry = (req.headers.get("cf-ipcountry") || "").toUpperCase();
    let provider: Provider = (intent.provider as Provider) || "stripe";
    if (intent.provider === "auto" || !intent.provider) {
      provider = cfCountry === "AR" ? "mercadopago" : "stripe";
      await supabaseAdmin
        .from("signup_intents")
        .update({ provider })
        .eq("id", intent_id);
    }

    if (!["draft", "checkout_created", "paid_ready"].includes(intent.status)) {
      return json({ error: "El intent no está en un estado válido" }, 409);
    }

    // If payment method already captured inline, skip checkout
    if (intent.stripe_payment_method_id) {
      // Create Stripe customer and attach payment method
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY no configurado" }, 500);
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      // Create or get customer
      const customer = await stripe.customers.create({
        email: intent.email,
        name: intent.full_name ?? undefined,
        metadata: { intent_id: intent.id },
      });

      // Attach payment method to customer
      await stripe.paymentMethods.attach(intent.stripe_payment_method_id, {
        customer: customer.id,
      });

      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: intent.stripe_payment_method_id },
      });

      // Update intent to paid_ready
      await supabaseAdmin
        .from("signup_intents")
        .update({
          status: "paid_ready",
          provider: "stripe",
          billing_plan_id: intent.plan_id === FREE_PLAN_ID ? BASIC_PLAN_ID : (intent.billing_plan_id ?? intent.plan_id),
          trial_days: intent.plan_id === FREE_PLAN_ID ? FREE_TRIAL_DAYS : 0,
        })
        .eq("id", intent_id);

      return json({ is_paid_ready: true, provider: "stripe" }, 200);
    }

    // Determine trial & billing plan
    const trialDays = intent.plan_id === FREE_PLAN_ID ? FREE_TRIAL_DAYS : 0;
    const billingPlanId = intent.plan_id === FREE_PLAN_ID ? BASIC_PLAN_ID : (intent.billing_plan_id ?? intent.plan_id);

    // Load billing plan for better descriptions
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, price, active")
      .eq("id", billingPlanId)
      .single();

    if (planErr || !plan || !plan.active) {
      return json({ error: "Plan de cobro inválido" }, 400);
    }

    if (provider === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY no configurado" }, 500);

      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      // Use Checkout in setup mode to save payment method without charging now
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        payment_method_types: ["card"],
        success_url: `${success_url}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url,
        customer_email: intent.email,
        metadata: { intent_id: intent.id },
      });

      const { error: updErr } = await supabaseAdmin
        .from("signup_intents")
        .update({
          status: "checkout_created",
          stripe_checkout_session_id: session.id,
          billing_plan_id: billingPlanId,
          trial_days: trialDays,
        })
        .eq("id", intent_id);

      if (updErr) return json({ error: String(updErr.message ?? updErr) }, 500);

      return json({ checkout_url: session.url, provider: "stripe" }, 200);
    }

    if (provider === "mercadopago") {
      const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
      if (!mpToken) return json({ error: "MP_ACCESS_TOKEN no configurado" }, 500);
      // Create preapproval to save payment method; charge starts at trial end
      const usdArs = Number(Deno.env.get("DEFAULT_USD_ARS_RATE") ?? "1000");
      const amountArsRecurring = Math.round(Number(plan.price) * usdArs);

      const body = {
        reason: `Suscripción ${plan.name}`,
        payer_email: intent.email,
        back_url: success_url,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amountArsRecurring,
          currency_id: "ARS",
          start_date: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const resp = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const jsonResp = await resp.json();
      if (!resp.ok) {
        return json({ error: jsonResp?.message ?? "MercadoPago error" }, 502);
      }

      const redirectUrl = jsonResp.init_point || jsonResp.sandbox_init_point || null;
      const { error: updErr } = await supabaseAdmin
        .from("signup_intents")
        .update({
          status: "checkout_created",
          mp_preapproval_id: jsonResp.id,
          billing_plan_id: billingPlanId,
          trial_days: trialDays,
        })
        .eq("id", intent_id);

      if (updErr) return json({ error: String(updErr.message ?? updErr) }, 500);

      return json({ checkout_url: redirectUrl, provider: "mercadopago" }, 200);
    }

    return json({ error: "Provider inválido" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
