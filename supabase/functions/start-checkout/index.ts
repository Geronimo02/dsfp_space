// supabase/functions/start-checkout/index.ts
// Inline CORS to avoid cold-start issues
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { corsHeaders as sharedCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
type Provider = "mercadopago";

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
    let provider: Provider = "mercadopago";
    if (intent.provider !== "mercadopago") {
      await supabaseAdmin
        .from("signup_intents")
        .update({ provider: "mercadopago" })
        .eq("id", intent_id);
    }

    if (!["draft", "checkout_created", "paid_ready"].includes(intent.status)) {
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

    if (provider === "mercadopago") {
      const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
      if (!mpToken) return json({ error: "MP_ACCESS_TOKEN no configurado" }, 500);
      
      // For MercadoPago, create preapproval with immediate billing
      const usdArs = Number(Deno.env.get("DEFAULT_USD_ARS_RATE") ?? "1000");
      const amountArsRecurring = Math.round(Number(plan.price) * usdArs);

      // Create preapproval with immediate start date (cobro inmediato)
      const preapprovalBody = {
        reason: `Suscripción ${plan.name}`,
        payer_email: intent.email,
        external_reference: intent.id,
        back_url: success_url,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amountArsRecurring,
          currency_id: "ARS",
          // NO start_date = cobro inmediato al autorizar
        },
      };

      const mpResp = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${mpToken}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify(preapprovalBody),
      });

      const mpData = await mpResp.json();
      
      if (!mpResp.ok) {
        console.error("MP preapproval error:", mpData);
        return json({ error: mpData?.message ?? "Error al crear suscripción en MercadoPago" }, 502);
      }

      const checkoutUrl = mpData.init_point ?? mpData.sandbox_init_point;
      
      if (!checkoutUrl) {
        return json({ error: "No se obtuvo URL de checkout de MercadoPago" }, 502);
      }

      // Update intent with preapproval info
      const { error: updErr } = await supabaseAdmin
        .from("signup_intents")
        .update({
          status: "checkout_created",
          provider: "mercadopago",
          mp_preapproval_id: mpData.id,
          billing_plan_id: billingPlanId,
          trial_days: trialDays,
          amount_ars: amountArsRecurring,
          fx_rate_usd_ars: usdArs,
          fx_rate_at: new Date().toISOString(),
        })
        .eq("id", intent_id);

      if (updErr) return json({ error: String(updErr.message ?? updErr) }, 500);

      // Redirect to MercadoPago checkout
      return json({ 
        checkout_url: checkoutUrl, 
        provider: "mercadopago",
        preapproval_id: mpData.id
      }, 200);
    }

    return json({ error: "Provider inválido" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
