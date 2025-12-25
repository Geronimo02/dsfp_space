import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    const { email, name } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Create setup intent for saving payment method
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      metadata: {
        email,
        name: name || "",
        purpose: "signup",
      },
    });

    return new Response(
      JSON.stringify({
        client_secret: setupIntent.client_secret,
        setup_intent_id: setupIntent.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating setup intent:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error creating setup intent",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
