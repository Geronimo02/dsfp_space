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
    const { token, email, plan_id } = await req.json();

    console.log(`[mp-test-card-token] Processing charge for plan ${plan_id}, email: ${email}`);

    if (!token || !email || !plan_id) {
      return json({ error: "Missing token, email or plan_id" }, 400);
    }

    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpAccessToken) {
      return json({ error: "MP not configured" }, 500);
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
      console.error("[mp-test-card-token] Plan not found:", plan_id);
      return json({ error: "Plan no encontrado" }, 404);
    }

    // Convert USD to ARS (get exchange rate from env or default)
    const usdArsRate = Number(Deno.env.get("DEFAULT_USD_ARS_RATE") ?? "1000");
    const amountARS = Math.round(plan.price * usdArsRate);

    console.log(`[mp-test-card-token] Charging $${plan.price} USD (${amountARS} ARS) for ${plan.name}`);

    try {
      // Create a PAYMENT (not preapproval) to ACTUALLY CHARGE the subscription amount
      const paymentPayload = {
        transaction_amount: amountARS,
        description: `Suscripción ${plan.name}`,
        payment_method_id: "master", // This will be auto-detected from token
        token: token,
        installments: 1,
        payer: {
          email: email,
        },
        metadata: {
          email: email,
          plan_id: plan_id,
          plan_name: plan.name,
        },
      };

      console.log(`[mp-test-card-token] Creating payment...`);

      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentPayload),
      });

      const mpData = await mpResponse.json();

      console.log(`[mp-test-card-token] MP payment response status:`, mpResponse.status, "status_detail:", mpData.status_detail);

      if (mpData.status === "approved") {
        console.log(`[mp-test-card-token] Payment successful! ID:`, mpData.id);

        // Update signup_payment_methods with payment info
        await supabase
          .from("signup_payment_methods")
          .update({
            payment_verified: true,
            payment_id: String(mpData.id),
            amount: plan.price,
            currency: "USD",
            plan_id: plan_id,
          })
          .eq("email", email)
          .eq("provider", "mercadopago");

        return json({
          verified: true,
          payment_id: mpData.id,
          amount: plan.price,
        });
      } else {
        // Payment was rejected or failed
        let errorMsg = mpData.status_detail || mpData.message || "Pago rechazado";

        // Map common MP error codes
        if (mpData.cause && Array.isArray(mpData.cause)) {
          const codes = mpData.cause.map((c: any) => c.code).join(", ");
          
          if (codes.includes("FUND") || codes.includes("2067")) {
            errorMsg = "Fondos insuficientes";
          } else if (codes.includes("CALL")) {
            errorMsg = "Comunicate con tu banco";
          } else if (codes.includes("SECU") || codes.includes("E301")) {
            errorMsg = "Código de seguridad inválido";
          } else if (codes.includes("EXPI") || codes.includes("E203")) {
            errorMsg = "Tarjeta vencida";
          } else if (codes.includes("E205")) {
            errorMsg = "Número de tarjeta inválido";
          } else {
            errorMsg = `Tarjeta rechazada: ${codes}`;
          }
        } else if (mpData.status_detail) {
          // Map status_detail codes
          if (mpData.status_detail === "cc_rejected_insufficient_amount") {
            errorMsg = "Fondos insuficientes";
          } else if (mpData.status_detail === "cc_rejected_bad_filled_security_code") {
            errorMsg = "Código de seguridad incorrecto";
          } else if (mpData.status_detail === "cc_rejected_call_for_authorize") {
            errorMsg = "Comunicate con tu banco para autorizar el pago";
          } else if (mpData.status_detail === "cc_rejected_card_disabled") {
            errorMsg = "Tarjeta deshabilitada";
          }
        }

        console.error(`[mp-test-card-token] Payment rejected:`, errorMsg);

        // Save error to database
        await supabase
          .from("signup_payment_methods")
          .update({
            payment_verified: false,
            payment_error: errorMsg,
          })
          .eq("email", email)
          .eq("provider", "mercadopago");

        return json({ verified: false, error: errorMsg });
      }
    } catch (mpError: any) {
      console.error("[mp-test-card-token] MP error:", mpError.message);

      const errorMsg = mpError.message || "Error al procesar el pago";

      // Save error to database
      await supabase
        .from("signup_payment_methods")
        .update({
          payment_verified: false,
          payment_error: errorMsg,
        })
        .eq("email", email)
        .eq("provider", "mercadopago");

      return json({ verified: false, error: errorMsg });
    }
  } catch (e: any) {
    console.error("[mp-test-card-token] Unexpected error:", e.message);
    return json({ error: e.message || "Error inesperado" }, 500);
  }
});

