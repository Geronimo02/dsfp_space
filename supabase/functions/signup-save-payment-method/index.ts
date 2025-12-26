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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { email, name, billing_country, provider, payment_method_ref } = await req.json();

    // Validate inputs
    if (!email || !name || !billing_country || !provider || !payment_method_ref) {
      return json(
        { error: "Missing required fields: email, name, billing_country, provider, payment_method_ref" },
        400
      );
    }

    if (!["stripe", "mercadopago"].includes(provider)) {
      return json({ error: "Invalid provider. Must be 'stripe' or 'mercadopago'" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Store payment method reference in signup_payment_methods table
    // This is a temporary table that gets linked when the account is actually created
    const { data, error } = await supabase
      .from("signup_payment_methods")
      .insert({
        email,
        name,
        billing_country,
        provider,
        payment_method_ref,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving payment method:", error);
      return json({ error: error.message ?? "Failed to save payment method" }, 500);
    }

    return json({
      ok: true,
      message: "Payment method saved for signup",
      id: data.id,
    });
  } catch (e) {
    console.error("Error in signup-save-payment-method:", e);
    return json({ error: String(e) }, 500);
  }
});
