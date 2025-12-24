// supabase/functions/save-stripe-payment-method/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { payment_method_id, company_id } = await req.json();
    if (!payment_method_id && !company_id) return json({ error: "payment_method_id o company_id requerido" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const supabase = createClient(url, key);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Load subscription and customer
    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("id, provider_customer_id")
      .eq("company_id", company_id)
      .maybeSingle();
    if (subErr || !sub) return json({ error: subErr?.message ?? "Suscripción no encontrada" }, 404);

    const customerId = sub.provider_customer_id;
    if (!customerId) return json({ error: "Stripe customer no encontrado" }, 404);

    // Attach payment method to customer and set default
    await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: payment_method_id } });

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
