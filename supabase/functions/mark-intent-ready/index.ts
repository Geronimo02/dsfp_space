// supabase/functions/mark-intent-ready/index.ts
// Marks signup intent as paid_ready after checkout completes

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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
      .select("id, provider, mp_preapproval_id, stripe_checkout_session_id, stripe_customer_id")
      .eq("id", intent_id)
      .single();
    if (intentErr || !intent) return json({ error: intentErr?.message ?? "Intent no encontrado" }, 404);

    if (intent.provider === "mercadopago") {
      if (!intent.mp_preapproval_id) return json({ error: "Preapproval no encontrado" }, 409);
      const { error: updErr } = await supabase
        .from("signup_intents")
        .update({ status: "paid_ready" })
        .eq("id", intent_id);
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ ok: true, provider: "mercadopago" });
    }

    if (intent.provider === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY no configurado" }, 500);
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      const sid = stripe_session_id || intent.stripe_checkout_session_id;
      if (!sid) return json({ error: "stripe_session_id requerido" }, 400);

      const session = await stripe.checkout.sessions.retrieve(sid);
      // For setup mode, session.setup_intent contains the SetupIntent id
      const setupIntentId = session.setup_intent as string | null;
      let paymentMethodId: string | null = null;
      let customerId: string | null = (session.customer as string | null) ?? null;

      if (setupIntentId) {
        const si = await stripe.setupIntents.retrieve(setupIntentId);
        paymentMethodId = (si.payment_method as string | null) ?? null;
        customerId = customerId || (si.customer as string | null) || null;
      }

      const { error: updErr } = await supabase
        .from("signup_intents")
        .update({ status: "paid_ready", stripe_customer_id: customerId, stripe_payment_method_id: paymentMethodId })
        .eq("id", intent_id);
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ ok: true, provider: "stripe", customerId, paymentMethodId });
    }

    return json({ error: "Provider inválido" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
