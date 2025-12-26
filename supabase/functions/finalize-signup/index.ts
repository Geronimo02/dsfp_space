// supabase/functions/finalize-signup/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // 6️⃣ Guardar método de pago de signup (si existe) como método de la empresa
    try {
      const { data: spm } = await supabaseAdmin
        .from("signup_payment_methods")
        .select("id, provider, payment_method_ref")
        .eq("email", intent.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (spm) {
        // Check if company has methods already
        const { data: existing } = await supabaseAdmin
          .from("company_payment_methods")
          .select("id")
          .eq("company_id", companyId);

        const isFirst = !existing || existing.length === 0;

        if (spm.provider === "stripe") {
          // Store as card without brand info (can be enriched later)
          await supabaseAdmin
            .from("company_payment_methods")
            .insert({
              company_id: companyId,
              type: "card",
              stripe_payment_method_id: spm.payment_method_ref,
              is_default: isFirst,
            });
        } else if (spm.provider === "mercadopago") {
          await supabaseAdmin
            .from("company_payment_methods")
            .insert({
              company_id: companyId,
              type: "mercadopago",
              mp_preapproval_id: intent.mp_preapproval_id ?? null,
              is_default: isFirst,
            });
        }

        // Link temp record to company
        await supabaseAdmin
          .from("signup_payment_methods")
          .update({ linked_to_company_id: companyId })
          .eq("id", spm.id);
      }
    } catch (e) {
      // Non-blocking: continue even if linking fails
      console.warn("[finalize-signup] No payment method linked:", e);
    }

    // 7️⃣ Marcar intent como completado con trial info
    const { error: updErr } = await supabaseAdmin
      .from("signup_intents")
      .update({ 
        status: "completed",
        company_id: companyId,
        trial_ends_at: trialEndsAt
      })
      .eq("id", intent_id);

    if (updErr) return json({ error: String(updErr.message ?? updErr) }, 500);

    return json({ ok: true, redirect_to: "/auth" }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
