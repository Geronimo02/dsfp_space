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
    const { payment_method_id, provider, email } = await req.json();

    console.log(`[verify-signup-payment] Verifying ${provider} payment for ${email}`);

    if (!payment_method_id || !provider || !email) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let paymentVerified = false;
    let paymentError = "";

    if (provider === "stripe") {
      try {
        // Dynamic import of Stripe
        const { default: Stripe } = await import("https://esm.sh/stripe@15.0.0");
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "");

        // Retrieve the payment method to verify it exists and is valid
        const pm = await stripe.paymentMethods.retrieve(payment_method_id);
        
        console.log(`[verify-signup-payment] Stripe PM retrieved: ${pm.id}, type: ${pm.type}`);

        if (pm.type !== "card") {
          paymentError = "Payment method is not a card";
        } else if (!pm.card) {
          paymentError = "Card data is invalid";
        } else {
          // Card exists and is valid - this is sufficient verification for signup
          // The actual charge will happen later when subscription activates
          paymentVerified = true;
          console.log(`[verify-signup-payment] Stripe card verified: ${pm.card.brand} ${pm.card.last4}`);
        }
      } catch (err: any) {
        paymentError = err.message || "Stripe verification failed";
        console.error(`[verify-signup-payment] Stripe error:`, err.message);
      }
    } else if (provider === "mercadopago") {
      try {
        // For MP, payment_method_id is now the preapproval ID (not token)
        // The card was already validated in Step 4 when creating the preapproval
        // We just verify it exists in our DB
        
        console.log(`[verify-signup-payment] Verifying MP preapproval exists:`, payment_method_id);
        
        const { data: pmRecord, error: pmErr } = await supabase
          .from("signup_payment_methods")
          .select("id, payment_method_ref, brand")
          .eq("payment_method_ref", payment_method_id)
          .eq("email", email)
          .single();

        if (pmErr || !pmRecord) {
          paymentError = "Payment method record not found";
          console.error(`[verify-signup-payment] MP record not found:`, pmErr);
        } else {
          // Preapproval exists in DB - card was validated in Step 4
          paymentVerified = true;
          console.log(`[verify-signup-payment] MP preapproval verified: ${pmRecord.id}`);
        }
      } catch (err: any) {
        paymentError = err.message || "MercadoPago verification failed";
        console.error(`[verify-signup-payment] MP error:`, err.message);
      }
    } else {
      paymentError = `Unknown provider: ${provider}`;
    }

    // Update signup_payment_methods with verification result
    const { error: updateErr } = await supabase
      .from("signup_payment_methods")
      .update({
        payment_verified: paymentVerified,
        payment_error: paymentError || null,
      })
      .eq("payment_method_ref", payment_method_id)
      .eq("email", email);

    if (updateErr) {
      console.error(`[verify-signup-payment] Update error:`, updateErr);
      return json({ error: updateErr.message }, 500);
    }

    if (!paymentVerified) {
      console.warn(`[verify-signup-payment] Payment not verified for ${email}: ${paymentError}`);
    }

    return json({
      ok: true,
      verified: paymentVerified,
      error: paymentError || null,
    });
  } catch (e) {
    console.error("[verify-signup-payment] Unexpected error:", e);
    return json({ error: String(e) }, 500);
  }
});
