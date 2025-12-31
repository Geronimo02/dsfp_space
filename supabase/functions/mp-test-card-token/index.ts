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

// Map MP status_detail codes to user-friendly messages
function getMPErrorMessage(statusDetail: string | null): string {
  const errorMap: Record<string, string> = {
    "cc_rejected_insufficient_amount": "Fondos insuficientes",
    "cc_rejected_call_for_authorize": "Validación requerida - contacte su banco",
    "cc_rejected_invalid_installments": "Cuotas no válidas para esta tarjeta",
    "cc_rejected_other_reason": "Tarjeta rechazada - motivo desconocido",
    "cc_rejected_fraud": "Transacción bloqueada por seguridad",
    "cc_rejected_high_risk": "Transacción de alto riesgo",
    "cc_rejected_blacklist": "Tarjeta rechazada",
    "cc_rejected_card_error": "Error en la tarjeta",
    "cc_rejected_by_bank": "Banco rechazó la transacción",
    "cc_rejected_insufficient_data": "Datos insuficientes para procesar",
    "invalid_token": "Token inválido o expirado",
    "bad_request": "Solicitud inválida",
  };

  if (!statusDetail) return "Tarjeta rechazada";
  
  return errorMap[statusDetail.toLowerCase()] || `Tarjeta rechazada: ${statusDetail}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { token, email, plan_id } = await req.json();

    console.log(`[mp-test-card-token] Charging MP payment - email: ${email}, plan: ${plan_id}`);

    if (!token || !email || !plan_id) {
      return json({ verified: false, error: "Missing required fields" }, 400);
    }

    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpAccessToken) {
      return json({ verified: false, error: "MP not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get plan details
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("price")
      .eq("id", plan_id)
      .single();

    if (planErr || !plan) {
      console.error("[mp-test-card-token] Plan not found");
      return json({ verified: false, error: "Plan not found" }, 404);
    }

    // Convert USD to ARS
    const usdArsRate = Number(Deno.env.get("DEFAULT_USD_ARS_RATE") ?? "1000");
    const amountARS = Math.round(plan.price * usdArsRate);

    console.log(`[mp-test-card-token] Creating payment - Amount: ${amountARS} ARS`);

    // Create payment with the token
    const paymentPayload = {
      token: token,
      transaction_amount: amountARS,
      description: `Suscripción - ${email}`,
      installments: 1,
      payer: {
        email: email,
      },
    };

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${email}-${plan_id}-${Date.now()}`,
      },
      body: JSON.stringify(paymentPayload),
    });

    const mpData = await mpResponse.json();

    console.log(`[mp-test-card-token] MP response status:`, mpResponse.status);
    console.log(`[mp-test-card-token] Payment status:`, mpData.status, "Detail:", mpData.status_detail);

    // Check if the request itself failed
    if (!mpResponse.ok) {
      console.error("[mp-test-card-token] MP API error:", mpData);
      
      let errorMsg = "Error al procesar la tarjeta";
      if (mpData.message) {
        errorMsg = mpData.message;
      }

      await supabase
        .from("signup_payment_methods")
        .update({
          payment_verified: false,
          payment_error: errorMsg,
        })
        .eq("email", email)
        .eq("provider", "mercadopago");

      return json({
        verified: false,
        error: errorMsg,
      });
    }

    // Check payment status - approved means it went through
    if (mpData.status !== "approved") {
      console.log("[mp-test-card-token] Payment rejected. Status:", mpData.status);
      
      const userFriendlyError = getMPErrorMessage(mpData.status_detail);

      await supabase
        .from("signup_payment_methods")
        .update({
          payment_verified: false,
          payment_error: userFriendlyError,
        })
        .eq("email", email)
        .eq("provider", "mercadopago");

      return json({
        verified: false,
        error: userFriendlyError,
      });
    }

    console.log("[mp-test-card-token] Payment approved! ID:", mpData.id);

    await supabase
      .from("signup_payment_methods")
      .update({
        payment_verified: true,
        payment_id: String(mpData.id),
        amount: amountARS,
        currency: "ARS",
        plan_id: plan_id,
      })
      .eq("email", email)
      .eq("provider", "mercadopago");

    return json({
      verified: true,
      payment_id: mpData.id,
    });
  } catch (e) {
    console.error("[mp-test-card-token] Unexpected error:", e);
    return json({ verified: false, error: String(e) }, 500);
  }
});



