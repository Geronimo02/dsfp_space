// supabase/functions/save-stripe-payment-method/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const { payment_method_id, company_id } = await req.json();
    if (!payment_method_id) return json({ error: "payment_method_id requerido" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabaseUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(url, serviceRoleKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return json({ error: "No autorizado" }, 401);

    // Get payment method details from Stripe
    const pm = await stripe.paymentMethods.retrieve(payment_method_id);

    // Resolve company_id: prefer explicit, otherwise fallback to first active
    let targetCompanyId: string | null = null;
    if (company_id) {
      const { data: cuForCompany } = await supabaseAdmin
        .from("company_users")
        .select("company_id")
        .eq("company_id", company_id)
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      if (!cuForCompany) return json({ error: "No tienes acceso a la empresa indicada" }, 403);
      targetCompanyId = company_id;
    } else {
      const { data: companyUser } = await supabaseAdmin
        .from("company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      targetCompanyId = companyUser?.company_id ?? null;
    }

    if (!targetCompanyId) return json({ error: "No se encontró empresa activa" }, 404);

    // Check if this is the first payment method for the company
    const { data: existingMethods } = await supabase
      .from("company_payment_methods")
      .select("id")
      .eq("company_id", companyUser.company_id);

    const isFirstMethod = !existingMethods || existingMethods.length === 0;

    // Save payment method to database
    const { data: savedMethod, error: saveError } = await supabaseAdmin
      .from("company_payment_methods")
      .insert({
        company_id: targetCompanyId,
        type: "card",
        stripe_payment_method_id: payment_method_id,
        brand: pm.card?.brand || null,
        last4: pm.card?.last4 || null,
        exp_month: pm.card?.exp_month || null,
        exp_year: pm.card?.exp_year || null,
        holder_name: pm.billing_details?.name || null,
        is_default: isFirstMethod,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Update subscription with the payment method if it's the default
    if (isFirstMethod) {
      const { data: subscription } = await supabaseAdmin
        .from("subscriptions")
        .select("id, provider_customer_id")
        .eq("company_id", targetCompanyId)
        .maybeSingle();

      if (subscription) {
        // Attach to Stripe customer if exists
        if (subscription.provider_customer_id) {
          await stripe.paymentMethods.attach(payment_method_id, { 
            customer: subscription.provider_customer_id 
          });
          await stripe.customers.update(subscription.provider_customer_id, { 
            invoice_settings: { default_payment_method: payment_method_id } 
          });
        }

        // Update subscription record to reflect in UI
        await supabaseAdmin
          .from("subscriptions")
          .update({ stripe_payment_method_id: payment_method_id })
          .eq("id", subscription.id);
      }
    }

    return json({ success: true, payment_method: savedMethod });
  } catch (e) {
    console.error("Error saving payment method:", e);
    return json({ error: String(e) }, 500);
  }
});
