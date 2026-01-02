// supabase/functions/finalize-signup/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@15.0.0";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Map MP status_detail codes to user-friendly messages
function getMPErrorMessage(statusDetail: string | null, message: string | null): string {
  // Priority 1: Map specific status_detail codes
  const errorMap: Record<string, string> = {
    "cc_rejected_insufficient_amount": "Fondos insuficientes en tu tarjeta",
    "cc_rejected_call_for_authorize": "Tu banco requiere validación. Contacta a tu banco",
    "cc_rejected_invalid_installments": "Cuotas no válidas para esta tarjeta",
    "cc_rejected_other_reason": "Tu tarjeta fue rechazada. Verifica los datos",
    "cc_rejected_fraud": "La transacción fue bloqueada por seguridad",
    "cc_rejected_high_risk": "Transacción de alto riesgo. Intenta más tarde",
    "cc_rejected_blacklist": "Tu tarjeta no puede ser utilizada",
    "cc_rejected_card_error": "Error en los datos de la tarjeta",
    "cc_rejected_by_bank": "Tu banco rechazó la transacción",
    "cc_rejected_insufficient_data": "Faltan datos de la tarjeta. Verifica",
    "invalid_token": "Tarjeta inválida o expirada",
    "bad_request": "Datos inválidos. Verifica tu información",
  };

  if (statusDetail && errorMap[statusDetail.toLowerCase()]) {
    return errorMap[statusDetail.toLowerCase()];
  }

  // Priority 2: Use MP message if it's user-friendly
  if (message && !message.includes("error") && message.length < 100) {
    return message;
  }

  // Priority 3: Generic helpful message
  return "No pudimos procesar tu tarjeta. Verifica los datos y que tengas fondos disponibles";
}

// Business constants
const FREE_PLAN_ID = "460d1274-59bc-4c99-a815-c3c1d52d0803";
const BASIC_PLAN_ID = "ea1d515e-5557-4b5c-a0b1-cd5ea9d13fc0";
const FREE_TRIAL_DAYS = 7;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { intent_id, password } = await req.json();

    if (!intent_id || !password) {
      return json({ error: "intent_id y password son requeridos" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: intent, error: intentErr } = await supabaseAdmin
      .from("signup_intents")
      .select("*")
      .eq("id", intent_id)
      .single();

    if (intentErr || !intent) {
      return json({ error: "Signup intent no encontrado" }, 404);
    }

    // Idempotency: if already completed, return success
    if (intent.status === "completed") {
      return json({ ok: true, redirect_to: "/auth" }, 200);
    }

    // =================================================================
    // STEP 1: CHARGE PAYMENT FIRST (before creating anything)
    // =================================================================
    console.log(`[finalize-signup] Step 1: Looking for payment method for email: ${intent.email}`);
    
    const { data: spm, error: spmErr } = await supabaseAdmin
      .from("signup_payment_methods")
      .select("*")
      .eq("email", intent.email)
      .is("linked_to_company_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (spmErr || !spm) {
      console.error("[finalize-signup] No payment method found:", spmErr);
      return json({ error: "No se encontró método de pago. Por favor, vuelve al paso anterior." }, 404);
    }

    console.log(`[finalize-signup] Found payment method: ${spm.id} provider: ${spm.provider}`);
    console.log(`[finalize-signup] Payment method details:`, {
      id: spm.id,
      provider: spm.provider,
      plan_id: spm.plan_id,
      payment_method_ref: spm.payment_method_ref,
      email: spm.email,
      payment_method_id: spm.payment_method_id,
      issuer_id: spm.issuer_id,
    });

    // Verify plan_id exists
    if (!spm.plan_id) {
      console.error("[finalize-signup] No plan_id in payment method:", spm);
      return json({ error: "No se encontró el plan seleccionado. Por favor, vuelve al paso anterior." }, 400);
    }

    let paymentId: string | null = null;
    let amountCharged = 0;
    let currencyCharged = "USD";

    // === CRITICAL: CHARGE THE PAYMENT FIRST ===
    if (spm.provider === "stripe") {
      console.log("[finalize-signup] Processing Stripe payment...");
      
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
        });

        // Get plan amount
        console.log(`[finalize-signup] Fetching plan details for plan_id: ${spm.plan_id}`);
        const { data: plan, error: planError } = await supabaseAdmin
          .from("subscription_plans")
          .select("price, currency")
          .eq("id", spm.plan_id)
          .single();

        if (planError || !plan) {
          console.error("[finalize-signup] Plan fetch error:", planError);
          throw new Error(`Plan not found: ${spm.plan_id}`);
        }

        const amountCents = Math.round(plan.price * 100);
        amountCharged = plan.price;
        currencyCharged = plan.currency || "USD";

        console.log(`[finalize-signup] Charging Stripe PaymentIntent: ${currencyCharged} ${plan.price} (${amountCents} cents)`);

        // Get the payment method to check if it has a customer
        const paymentMethod = await stripe.paymentMethods.retrieve(spm.payment_method_ref);
        const customerId = typeof paymentMethod.customer === 'string' ? paymentMethod.customer : paymentMethod.customer?.id;
        
        console.log(`[finalize-signup] PaymentMethod customer: ${customerId}`);

        const paymentIntentParams: any = {
          amount: amountCents,
          currency: currencyCharged.toLowerCase(),
          payment_method: spm.payment_method_ref,
          confirm: true,
          off_session: true,
          description: `Subscription payment for ${intent.email}`,
          metadata: {
            signup_intent_id: intent_id,
            plan_id: spm.plan_id,
            email: intent.email,
          },
        };

        // If payment method has a customer, include it
        if (customerId) {
          paymentIntentParams.customer = customerId;
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        if (paymentIntent.status !== "succeeded") {
          const errorMsg = `No pudimos procesar tu pago. Estado: ${paymentIntent.status}`;
          console.error("[finalize-signup] Stripe payment failed:", errorMsg);
          
          // Update payment method with error
          await supabaseAdmin
            .from("signup_payment_methods")
            .update({ payment_verified: false, payment_error: errorMsg })
            .eq("id", spm.id);

          return json({ error: errorMsg }, 400);
        }

        paymentId = paymentIntent.id;
        console.log(`[finalize-signup] ✅ Stripe payment succeeded: ${paymentId}`);

      } catch (err: any) {
        console.error("[finalize-signup] Stripe charge failed:", err);
        const errorMsg = err.message || "No pudimos procesar tu tarjeta. Verifica los datos y que tengas fondos disponibles";
        
        // Update signup_payment_methods with error
        await supabaseAdmin
          .from("signup_payment_methods")
          .update({ payment_verified: false, payment_error: errorMsg })
          .eq("id", spm.id);

        return json({ error: errorMsg }, 400);
      }

    } else if (spm.provider === "mercadopago") {
      console.log("[finalize-signup] Processing MercadoPago payment...");
      
      const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");
      if (!mpAccessToken) {
        return json({ error: "MP_ACCESS_TOKEN not configured" }, 500);
      }

      try {
        // Get plan amount
        console.log(`[finalize-signup] Fetching plan details for plan_id: ${spm.plan_id}`);
        const { data: plan, error: planError } = await supabaseAdmin
          .from("subscription_plans")
          .select("price")
          .eq("id", spm.plan_id)
          .single();

        if (planError || !plan) {
          console.error("[finalize-signup] Plan fetch error:", planError);
          throw new Error(`Plan not found: ${spm.plan_id}`);
        }

        // MP only supports ARS for Argentina
        const usdArsRate = Number(Deno.env.get("DEFAULT_USD_ARS_RATE") ?? "1000");
        const amountARS = Math.round(plan.price * usdArsRate);
        amountCharged = amountARS;
        currencyCharged = "ARS";

        console.log(`[finalize-signup] Charging MP Payment: ARS ${amountARS} (USD ${plan.price} * ${usdArsRate})`);

        const paymentPayload: any = {
          token: spm.payment_method_ref,
          transaction_amount: amountARS,
          description: `Subscription payment for ${intent.email}`,
          installments: 1,
          payer: { email: intent.email },
          external_reference: intent_id,
          metadata: {
            signup_intent_id: intent_id,
            plan_id: spm.plan_id,
          },
        };

        // Add MP-specific fields if available
        if (spm.payment_method_id) {
          paymentPayload.payment_method_id = spm.payment_method_id;
        }
        if (spm.issuer_id) {
          paymentPayload.issuer_id = spm.issuer_id;
        }

        console.log("[finalize-signup] MP Payment payload:", JSON.stringify(paymentPayload, null, 2));

        const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${mpAccessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": `finalize-${intent_id}-${Date.now()}`,
          },
          body: JSON.stringify(paymentPayload),
        });

        const mpData = await paymentResponse.json();

        console.log("[finalize-signup] MP Response status:", paymentResponse.status);
        console.log("[finalize-signup] MP Response data:", JSON.stringify(mpData, null, 2));

        if (!paymentResponse.ok || mpData.status !== "approved") {
          const errorMsg = getMPErrorMessage(
            mpData.status_detail || null,
            mpData.message || null
          );
          
          console.error("[finalize-signup] MP charge failed:", errorMsg);
          
          await supabaseAdmin
            .from("signup_payment_methods")
            .update({ payment_verified: false, payment_error: errorMsg })
            .eq("id", spm.id);

          return json({ error: errorMsg }, 400);
        }

        paymentId = String(mpData.id);
        
        // Extract card details from MP payment response
        const cardLast4 = mpData.card?.last_four_digits || null;
        const cardBrand = mpData.payment_method_id || spm.brand;
        
        console.log(`[finalize-signup] ✅ MP payment succeeded: ${paymentId}, last4: ${cardLast4}`);

        // Update payment method with card details
        if (cardLast4) {
          await supabaseAdmin
            .from("signup_payment_methods")
            .update({ 
              last4: cardLast4,
              brand: cardBrand,
              payment_verified: true,
            })
            .eq("id", spm.id);
        }

      } catch (err: any) {
        console.error("[finalize-signup] MP charge failed:", err);
        const errorMsg = err.message || "No pudimos procesar tu tarjeta. Verifica los datos y que tengas fondos disponibles";
        
        // Update signup_payment_methods with error
        await supabaseAdmin
          .from("signup_payment_methods")
          .update({ payment_verified: false, payment_error: errorMsg })
          .eq("id", spm.id);

        return json({ error: errorMsg }, 400);
      }
    }

    // Update payment method with success
    await supabaseAdmin
      .from("signup_payment_methods")
      .update({
        payment_verified: true,
        payment_id: paymentId,
        amount: amountCharged,
        currency: currencyCharged,
      })
      .eq("id", spm.id);

    console.log("[finalize-signup] ✅ Payment charged successfully, proceeding to create account...");

    // =================================================================
    // STEP 2: CREATE ACCOUNT (only after successful payment)
    // =================================================================

    if (intent.status !== "paid_ready") {
      return json({ error: "El pago/autorización aún no fue confirmado" }, 409);
    }

    // Determine final billed plan (basic if free was chosen)
    const finalPlanId = intent.plan_id === FREE_PLAN_ID ? BASIC_PLAN_ID : (intent.billing_plan_id ?? intent.plan_id);

    // Trial settings
    const trialEndsAt =
      intent.plan_id === FREE_PLAN_ID
        ? new Date(Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : (intent.trial_ends_at ?? null);

    // 2️⃣ Crear usuario Auth (admin)
    // Try to create user; if already exists, continue (idempotent)
    let userId: string | null = null;
    try {
      const { data: createdUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email: intent.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: intent.full_name ?? null },
      });

      if (userErr) {
        // If user already exists, proceed without failing
        const msg = String(userErr.message ?? userErr);
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registrado")) {
          // Try to find existing user via auth list (best-effort)
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
          const existing = usersList?.users?.find((u: any) => (u.email || "").toLowerCase() === String(intent.email).toLowerCase());
          userId = existing?.id ?? null;
        } else {
          return json({ error: msg }, 500);
        }
      } else {
        userId = createdUser?.user?.id ?? null;
      }
    } catch (e) {
      // Fallback: continue if intent has company already
      if (!userId) {
        return json({ error: String(e) }, 500);
      }
    }

    if (!userId) {
      return json({ error: "No se pudo obtener el usuario creado" }, 500);
    }

    // 3️⃣ Crear empresa
    const { data: company, error: companyErr } = await supabaseAdmin
      .from("companies")
      .insert({
        name: intent.company_name ?? intent.full_name ?? "Nueva empresa",
        email: intent.email,
        active: true,
      })
      .select("id")
      .single();

    if (companyErr || !company) {
      return json({ error: String(companyErr?.message ?? "No se pudo crear la empresa") }, 500);
    }

    const companyId = company.id;

    // 4️⃣ Asociar usuario a empresa como ADMIN
    const { error: cuErr } = await supabaseAdmin.from("company_users").insert({
      company_id: companyId,
      user_id: userId,
      role: "admin",
      active: true,
      platform_admin: false,
    });

    if (cuErr) return json({ error: String(cuErr.message ?? cuErr) }, 500);

    // 5️⃣ Crear suscripción (se guarda como plan final; si venía de Free, queda Basic trialing)
    const providerSubscriptionId =
      intent.provider === "stripe" ? intent.stripe_subscription_id : intent.mp_preapproval_id;

    const providerCustomerId = intent.provider === "stripe" ? intent.stripe_customer_id : null;

    const { error: subErr } = await supabaseAdmin.from("subscriptions").insert({
      company_id: companyId,
      plan_id: finalPlanId,
      provider: intent.provider,
      provider_customer_id: providerCustomerId,
      provider_subscription_id: providerSubscriptionId,
      status: "trialing",
      trial_ends_at: trialEndsAt,
      current_period_end: trialEndsAt,
      amount_usd: intent.amount_usd,
      amount_ars: intent.amount_ars ?? null,
      fx_rate_usd_ars: intent.fx_rate_usd_ars ?? null,
      fx_rate_at: intent.fx_rate_at ?? null,
      modules: intent.modules ?? [],
    });

    if (subErr) return json({ error: String(subErr.message ?? subErr) }, 500);

    // 6️⃣ Link the payment method we already charged to the company
    console.log("[finalize-signup] Step 6: Linking payment method to company:", companyId);
    
    // Refresh spm to get updated card details (for MP, last4 is set after payment)
    const { data: refreshedSpm } = await supabaseAdmin
      .from("signup_payment_methods")
      .select("*")
      .eq("id", spm.id)
      .single();
    
    const spmData = refreshedSpm || spm; // Use refreshed data if available
    
    if (spmData.provider === "stripe") {
      // Store card with metadata from signup
      const { error: insertErr } = await supabaseAdmin
        .from("company_payment_methods")
        .insert({
          company_id: companyId,
          type: "card",
          stripe_payment_method_id: spmData.payment_method_ref,
          stripe_payment_intent_id: paymentId, // Store the PaymentIntent ID
          brand: spmData.brand,
          last4: spmData.last4,
          exp_month: spmData.exp_month,
          exp_year: spmData.exp_year,
          is_default: true,
        });

      if (insertErr) {
        console.error("[finalize-signup] Error saving Stripe payment method:", insertErr);
      } else {
        console.log("[finalize-signup] Stripe payment method saved to company");
      }
    } else if (spmData.provider === "mercadopago") {
      // Store MP payment method
      const { error: insertErr } = await supabaseAdmin
        .from("company_payment_methods")
        .insert({
          company_id: companyId,
          type: "card",
          mp_payment_id: paymentId, // Store the MP payment ID
          brand: spmData.brand,
          last4: spmData.last4,
          exp_month: spmData.exp_month,
          exp_year: spmData.exp_year,
          is_default: true,
        });

      if (insertErr) {
        console.error("[finalize-signup] Error saving MP payment method:", insertErr);
      } else {
        console.log("[finalize-signup] MP payment method saved to company");
      }
    }

    // Mark payment method as linked to this company
    await supabaseAdmin
      .from("signup_payment_methods")
      .update({ linked_to_company_id: companyId })
      .eq("id", spmData.id);

    console.log("[finalize-signup] ✅ Payment method linked to company");

    // 7️⃣ Mark intent as completed with trial info
    const { error: updErr } = await supabaseAdmin
      .from("signup_intents")
      .update({ 
        status: "completed",
        company_id: companyId,
        trial_ends_at: trialEndsAt
      })
      .eq("id", intent_id);

    if (updErr) return json({ error: String(updErr.message ?? updErr) }, 500);

    console.log(`[finalize-signup] ✅ Signup complete! Company: ${companyId}, Payment: ${paymentId}`);

    return json({ 
      ok: true, 
      redirect_to: "/auth",
      company_id: companyId,
      payment_id: paymentId,
    }, 200);
  } catch (e) {
    console.error("[finalize-signup] Error:", e);
    return json({ error: String(e) }, 500);
  }
});
