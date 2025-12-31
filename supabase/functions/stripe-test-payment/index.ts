import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { payment_method_id, email, plan_id } = await req.json();

    console.log(`[stripe-test-payment] Processing charge for plan ${plan_id}, email: ${email}`);

    if (!payment_method_id || !email || !plan_id) {
      return json({ error: "Missing payment_method_id, email or plan_id" }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return json({ error: "Stripe not configured" }, 500);
    }

    // Get Supabase client to fetch plan details
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, name, price")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      console.error("[stripe-test-payment] Plan not found:", plan_id);
      return json({ error: "Plan no encontrado" }, 404);
    }

    const amountInCents = Math.round(plan.price * 100); // Convert to cents

    console.log(`[stripe-test-payment] Charging $${plan.price} USD for ${plan.name}`);

    // Dynamic import of Stripe
    const { default: Stripe } = await import("https://esm.sh/stripe@15.0.0");
    const stripe = new Stripe(stripeKey);

    try {
      // Create a PaymentIntent to ACTUALLY CHARGE the subscription amount
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method: payment_method_id,
        confirm: true,
        description: `Suscripción ${plan.name} - ${email}`,
        metadata: {
          email: email,
          plan_id: plan_id,
          plan_name: plan.name,
        },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
      });

      console.log(`[stripe-test-payment] PaymentIntent status:`, paymentIntent.status);

      if (paymentIntent.status === 'succeeded') {
        console.log(`[stripe-test-payment] Payment successful! ID:`, paymentIntent.id);
        
        // Update signup_payment_methods with payment info
        await supabase
          .from("signup_payment_methods")
          .update({
            payment_verified: true,
            payment_id: paymentIntent.id,
            amount: plan.price,
            currency: "USD",
            plan_id: plan_id,
          })
          .eq("email", email)
          .eq("provider", "stripe");

        return json({
          verified: true,
          payment_intent_id: paymentIntent.id,
          amount: plan.price,
        });
      } else if (paymentIntent.status === 'requires_action') {
        console.warn(`[stripe-test-payment] Requires authentication:`, paymentIntent.client_secret);
        
        await supabase
          .from("signup_payment_methods")
          .update({
            payment_verified: false,
            payment_error: "Tarjeta requiere autenticación adicional (3D Secure)",
          })
          .eq("email", email)
          .eq("provider", "stripe");

        return json({
          verified: false,
          error: "Tarjeta requiere autenticación adicional (3D Secure)",
          requires_action: true,
        });
      } else {
        const errorMsg = `Pago no procesado: ${paymentIntent.status}`;
        console.error(`[stripe-test-payment] Payment failed:`, errorMsg);
        
        await supabase
          .from("signup_payment_methods")
          .update({
            payment_verified: false,
            payment_error: errorMsg,
          })
          .eq("email", email)
          .eq("provider", "stripe");

        return json({
          verified: false,
          error: "El pago no pudo ser procesado",
        });
      }
    } catch (stripeErr: any) {
      console.error("[stripe-test-payment] Stripe error:", stripeErr.message);

      // Parse Stripe errors
      let userMessage = "Error al procesar el pago";

      if (stripeErr.type === 'StripeCardError') {
        const declineCode = stripeErr.decline_code;
        const errorCode = stripeErr.code;

        console.error(`[stripe-test-payment] Card error - Code: ${errorCode}, Decline: ${declineCode}`);

        if (declineCode === 'insufficient_funds' || errorCode === 'insufficient_funds') {
          userMessage = "Fondos insuficientes";
        } else if (declineCode === 'card_declined' || errorCode === 'card_declined') {
          userMessage = "Tarjeta rechazada por el banco";
        } else if (errorCode === 'expired_card') {
          userMessage = "Tarjeta vencida";
        } else if (errorCode === 'incorrect_cvc') {
          userMessage = "Código de seguridad incorrecto";
        } else {
          userMessage = stripeErr.message || userMessage;
        }
      } else {
        userMessage = stripeErr.message || userMessage;
      }

      // Save error to database
      await supabase
        .from("signup_payment_methods")
        .update({
          payment_verified: false,
          payment_error: userMessage,
        })
        .eq("email", email)
        .eq("provider", "stripe");

      return json({ verified: false, error: userMessage });
    }
  } catch (err: any) {
    console.error("[stripe-test-payment] Unexpected error:", err.message);
    return json({ verified: false, error: err.message || "Error inesperado" });
  }
});

