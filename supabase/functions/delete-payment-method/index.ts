import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const { method_id } = await req.json();
    if (!method_id) return json({ error: "method_id requerido" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabaseUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(url, serviceRoleKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Auth user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return json({ error: "No autorizado" }, 401);

    // Load payment method
    const { data: method, error: pmErr } = await supabaseAdmin
      .from("company_payment_methods")
      .select("id, company_id, type, stripe_payment_method_id, mp_preapproval_id, is_default")
      .eq("id", method_id)
      .maybeSingle();

    if (pmErr || !method) return json({ error: "Método no encontrado" }, 404);

    // Verify user belongs to company
    const { data: cu } = await supabaseAdmin
      .from("company_users")
      .select("id")
      .eq("company_id", method.company_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!cu) return json({ error: "No tienes acceso a esta empresa" }, 403);

    // Fetch subscription for customer info
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("id, provider, provider_customer_id, stripe_payment_method_id, mp_preapproval_id")
      .eq("company_id", method.company_id)
      .maybeSingle();

    // Detach Stripe PM if needed
    if (method.type === "card" && method.stripe_payment_method_id) {
      const pmId = method.stripe_payment_method_id;
      if (subscription?.provider_customer_id) {
        try {
          await stripe.paymentMethods.detach(pmId);
        } catch (e) {
          console.warn("Stripe detach warning", e);
        }
        try {
          await stripe.customers.update(subscription.provider_customer_id, {
            invoice_settings: { default_payment_method: null },
          });
        } catch (e) {
          console.warn("Stripe clear default warning", e);
        }
      }

      // Clear subscription pointer if pointing to this PM
      if (subscription?.stripe_payment_method_id === pmId) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ stripe_payment_method_id: null })
          .eq("id", subscription.id);
      }
    }

    // Clear MP pointer if matched
    if (method.type === "mercadopago" && method.mp_preapproval_id) {
      if (subscription?.mp_preapproval_id === method.mp_preapproval_id) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ mp_preapproval_id: null })
          .eq("id", subscription.id);
      }
    }

    // Delete payment method row
    await supabaseAdmin
      .from("company_payment_methods")
      .delete()
      .eq("id", method.id);

    // If it was default, set another as default
    if (method.is_default) {
      const { data: remaining } = await supabaseAdmin
        .from("company_payment_methods")
        .select("id")
        .eq("company_id", method.company_id)
        .order("created_at", { ascending: true });

      if (remaining && remaining.length > 0) {
        await supabaseAdmin
          .from("company_payment_methods")
          .update({ is_default: true })
          .eq("id", remaining[0].id);
      }
    }

    return json({ success: true });
  } catch (e) {
    console.error("delete-payment-method error", e);
    return json({ error: String(e) }, 500);
  }
});
