import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const {
      email,
      name,
      billing_country,
      provider,
      payment_method_ref,
      company_id,
      brand,
      last4,
      exp_month,
      exp_year,
      plan_id,
      payment_method_id,
      issuer_id,
      full_name,
      company_name,
      modules,
    } = await req.json();

    if (!provider || !payment_method_ref) {
      return json({ error: "provider and payment_method_ref are required" }, 400);
    }

    if (!email && !company_id) {
      return json({ error: "email is required when company_id is not provided" }, 400);
    }

    if (!["stripe", "mercadopago"].includes(provider)) {
      return json({ error: "Invalid provider. Must be 'stripe' or 'mercadopago'" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseAdmin = createClient(url, serviceRoleKey);

    // If the request carries an auth header, use it to validate company membership when company_id is present
    const authHeader = req.headers.get("Authorization") ?? undefined;
    const supabaseUser = authHeader
      ? createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
      : null;

    // If company_id is provided, store directly in company_payment_methods + subscriptions
    if (company_id) {
      if (supabaseUser) {
        const { data: userData } = await supabaseUser.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          const { data: cu } = await supabaseAdmin
            .from("company_users")
            .select("id")
            .eq("company_id", company_id)
            .eq("user_id", uid)
            .eq("active", true)
            .maybeSingle();
          if (!cu) return json({ error: "No tienes acceso a esta empresa" }, 403);
        }
      }

      const { data: existing } = await supabaseAdmin
        .from("company_payment_methods")
        .select("id")
        .eq("company_id", company_id);

      const isFirst = !existing || existing.length === 0;

      const insertPayload =
        provider === "stripe"
          ? {
              company_id,
              type: "card",
              stripe_payment_method_id: payment_method_ref,
              brand: brand ?? null,
              last4: last4 ?? null,
              exp_month: exp_month ?? null,
              exp_year: exp_year ?? null,
              holder_name: name ?? null,
              is_default: isFirst,
            }
          : {
              company_id,
              type: "mercadopago",
              mp_preapproval_id: payment_method_ref,
              holder_name: name ?? null,
              is_default: isFirst,
            };

      const { data: pm, error: insertErr } = await supabaseAdmin
        .from("company_payment_methods")
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) return json({ error: insertErr.message ?? "Failed to save payment method" }, 500);

      const subUpdate =
        provider === "stripe"
          ? { stripe_payment_method_id: payment_method_ref, mp_preapproval_id: null }
          : { mp_preapproval_id: payment_method_ref, stripe_payment_method_id: null };

      const { error: subErr } = await supabaseAdmin
        .from("subscriptions")
        .update(subUpdate)
        .eq("company_id", company_id);

      if (subErr) return json({ error: subErr.message ?? "Failed to update subscription" }, 500);

      return json({ ok: true, stored_in: "company", payment_method: pm });
    }

    // Fallback: staging during signup (no company yet)
    const { data, error } = await supabaseAdmin
      .from("signup_payment_methods")
      .insert({
        email,
        name,
        billing_country,
        provider,
        payment_method_ref,
        brand: brand ?? null,
        last4: last4 ?? null,
        exp_month: exp_month ?? null,
        exp_year: exp_year ?? null,
        plan_id: plan_id ?? null,
        payment_method_id: payment_method_id ?? null,
        issuer_id: issuer_id ?? null,
        full_name: full_name ?? null,
        company_name: company_name ?? null,
        modules: modules ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving payment method:", error);
      return json({ error: error.message ?? "Failed to save payment method" }, 500);
    }

    return json({
      ok: true,
      stored_in: "signup_staging",
      id: data.id,
    });
  } catch (e) {
    console.error("Error in signup-save-payment-method:", e);
    return json({ error: String(e) }, 500);
  }
});
