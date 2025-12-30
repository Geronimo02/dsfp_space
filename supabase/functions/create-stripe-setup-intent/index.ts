// supabase/functions/create-stripe-setup-intent/index.ts
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
    const { company_id } = await req.json();
    if (!company_id) return json({ error: "company_id requerido" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const supabase = createClient(url, key);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("id, company_id, provider_customer_id, companies!inner(company_users!inner(user_id), name)")
      .eq("company_id", company_id)
      .maybeSingle();
    if (subErr || !sub) return json({ error: subErr?.message ?? "Suscripción no encontrada" }, 404);

    // Get owner email
    const ownerUserId = sub.companies?.company_users?.[0]?.user_id;
    const { data: ownerUser } = await supabase.auth.admin.getUserById(ownerUserId || "");
    const email = ownerUser?.user?.email ?? undefined;

    let customerId = sub.provider_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({ email, description: `Company ${sub.companies?.name ?? company_id}` });
      customerId = customer.id;
      await supabase.from("subscriptions").update({ provider_customer_id: customerId }).eq("id", sub.id);
    }

    const setupIntent = await stripe.setupIntents.create({ customer: customerId, payment_method_types: ["card"], usage: "off_session" });
    return json({ client_secret: setupIntent.client_secret, customer_id: customerId });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
