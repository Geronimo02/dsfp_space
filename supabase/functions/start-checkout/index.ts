// supabase/functions/start-checkout/index.ts
import { corsHeaders } from "../_shared/cors.ts";
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
    return new Response("ok", { headers: corsHeaders });
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

    const provider: Provider = intent.provider;

    if (!["draft", "checkout_created"].includes(intent.status)) {
      return json({ error: "El intent no está en un estado válido" }, 409);
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

      const customer = await stripe.customers.create({
        email: intent.email,
        name: intent.full_name ?? undefined,
        metadata: { intent_id: intent.id },
      });

      // IMPORTANT: Stripe trial is set at subscription level
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.id,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: Math.round(Number(intent.amount_usd) * 100),
              recurring: { interval: "month" },
              product_data: {
                name: `Suscripción ${plan.name}`,
                description:
                  trialDays > 0 ? `Prueba gratis ${trialDays} días → se cobra luego` : `Plan ${billingPlanId}`,
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: trialDays > 0 ? trialDays : undefined,
          metadata: { intent_id: intent.id },
        },
        success_url,
        cancel_url,
        metadata: { intent_id: intent.id },
      });

      const { error: updErr } = await supabaseAdmin
        .from("signup_intents")
        .update({
          status: "checkout_created",
          stripe_customer_id: customer.id,
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

      // For free trial, we don't charge now; MercadoPago can't handle 0-amount preapprovals
      // We'll charge after trial ends via charge-trial-subscriptions
      const isFreeTrial = intent.plan_id === FREE_PLAN_ID || intent.amount_ars === 0;

      if (isFreeTrial) {
        // Free trial: just mark as ready for finalization, don't create preapproval yet
        const { error: updErr } = await supabaseAdmin
          .from("signup_intents")
          .update({
            status: "paid_ready", // Skip checkout_created, go straight to paid_ready for free trial
            billing_plan_id: billingPlanId,
            trial_days: trialDays,
          })
          .eq("id", intent_id);

        if (updErr) return json({ error: String(updErr.message ?? updErr) }, 500);

        // For free trial, return intent_id and skip checkout (frontend will handle via localStorage)
        return json({ 
          checkout_url: null, // No external checkout needed
          provider: "mercadopago",
          intent_id: intent_id, // Return intent_id so frontend can save it
          is_free_trial: true,
          message: "Free trial - no payment required"
        }, 200);
      }

      // Paid plan: create preapproval as usual
      const amountArs = Math.round(Number(intent.amount_ars));
      if (!isFinite(amountArs) || amountArs <= 0) {
        return json({ error: "intent.amount_ars inválido" }, 400);
      }

      const autoRecurring: any = {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amountArs,
        currency_id: "ARS",
      };

      const planPayload = {
        reason: `Suscripción ${plan.name}`,
        external_reference: intent.id,
        auto_recurring: autoRecurring,
        back_url: success_url,
      };

      const planRes = await fetch("https://api.mercadopago.com/preapproval_plan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(planPayload),
      });

      if (!planRes.ok) {
        const errTxt = await planRes.text();
        console.log("MP plan error payload:", planPayload);
        console.log("MP plan error response:", errTxt);
        return json({ error: `MP plan error: ${errTxt}` }, 502);
      }

      const mpPlan = await planRes.json();

      const checkoutUrl = mpPlan.init_point || mpPlan.sandbox_init_point;
      if (!checkoutUrl) {
        console.log("MP plan response (no init_point):", mpPlan);
        return json({ error: "MP no devolvió init_point/sandbox_init_point en preapproval_plan" }, 502);
      }

      const { error: updErr } = await supabaseAdmin
        .from("signup_intents")
        .update({
          status: "checkout_created",
          mp_preapproval_plan_id: mpPlan.id,
          billing_plan_id: billingPlanId,
          trial_days: trialDays,
        })
        .eq("id", intent_id);

      if (updErr) return json({ error: String(updErr.message ?? updErr) }, 500);

      return json({ checkout_url: checkoutUrl, provider: "mercadopago" }, 200);
    }

    return json({ error: "Provider inválido" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
