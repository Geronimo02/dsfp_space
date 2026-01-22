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

async function findAuthUserIdByEmail(
  supabaseAdmin: any,
  email: string
): Promise<string | null> {
  const needle = String(email).trim().toLowerCase();
  const perPage = 200;

  // Search a few pages; projects usually have low user counts.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = (data?.users ?? []).find((u: any) => (u?.email ?? "").toLowerCase() === needle);
    if (found?.id) return found.id;

    // Stop when no more pages
    if (!data?.nextPage || (data?.users?.length ?? 0) < perPage) break;
  }

  return null;
}

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

    console.log("[finalize-signup] Start", { intent_id });

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
    // Try to create user; if already exists, recover user id via pagination.
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
          console.log("[finalize-signup] User already exists, searching by email...");
          userId = await findAuthUserIdByEmail(supabaseAdmin, intent.email);

          if (userId) {
            // Ensure the password matches what the user just set in the wizard
            const { error: updUserErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
              password,
              email_confirm: true,
            });
            if (updUserErr) {
              console.warn("[finalize-signup] Could not update existing user password:", updUserErr);
            }
          }
        } else {
          return json({ error: msg, step: "create_user" }, 500);
        }
      } else {
        userId = createdUser?.user?.id ?? null;
      }
    } catch (e) {
      // Fallback: continue if intent has company already
      if (!userId) {
        return json({ error: String(e), step: "create_user_exception" }, 500);
      }
    }

    if (!userId) {
      return json(
        {
          error: "No se pudo obtener el usuario (ya existe pero no se pudo encontrar por email)",
          step: "resolve_existing_user",
        },
        500
      );
    }

    // 3️⃣ Crear / recuperar empresa (idempotente)
    let companyId: string | null = intent.company_id ?? null;
    if (companyId) {
      const { data: existingCompany, error: existingCompanyErr } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .maybeSingle();

      if (existingCompanyErr || !existingCompany) {
        console.warn("[finalize-signup] intent.company_id present but not found, will recreate", {
          companyId,
          existingCompanyErr,
        });
        companyId = null;
      }
    }

    if (!companyId) {
      const companyEmail = String(intent.email).trim().toLowerCase();
      const companyName = String(intent.company_name ?? intent.full_name ?? "Nueva empresa").trim();
      
      console.log("[finalize-signup] Creating company with:", { 
        name: companyName, 
        email: companyEmail 
      });
      
      // Insert only minimal required fields to avoid JSON type issues
      const { data: company, error: companyErr } = await supabaseAdmin
        .from("companies")
        .insert({
          name: companyName,
          email: companyEmail,
          active: true,
        })
        .select("id")
        .single();

      if (companyErr || !company) {
        console.warn("[finalize-signup] Company insert failed:", {
          code: companyErr?.code,
          message: companyErr?.message,
          details: companyErr?.details,
        });
        
        // If the insert fails, try to reuse existing company by email
        const { data: byEmail, error: byEmailErr } = await supabaseAdmin
          .from("companies")
          .select("id")
          .eq("email", companyEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log("[finalize-signup] Fallback search result:", { byEmail, byEmailErr });

        if (byEmailErr || !byEmail) {
          return json(
            { 
              error: String(companyErr?.message ?? "No se pudo crear la empresa"), 
              step: "create_company",
              details: companyErr?.details ?? null
            },
            500
          );
        }
        companyId = byEmail.id;
        console.log("[finalize-signup] Reusing existing company:", companyId);
      } else {
        companyId = company.id;
        console.log("[finalize-signup] Created new company:", companyId);
      }
    }

    // Persist company_id early for retries
    try {
      await supabaseAdmin.from("signup_intents").update({ company_id: companyId }).eq("id", intent_id);
    } catch (e) {
      console.warn("[finalize-signup] Could not persist company_id early:", e);
    }

    // 4️⃣ Asociar usuario a empresa como ADMIN
    const { error: cuErr } = await supabaseAdmin.from("company_users").insert({
      company_id: companyId,
      user_id: userId,
      role: "admin",
      active: true,
      platform_admin: false,
    });

    if (cuErr) {
      const msg = String(cuErr.message ?? cuErr);
      // Ignore duplicates on retries
      if (!msg.toLowerCase().includes("duplicate")) {
        return json({ error: msg, step: "link_company_user" }, 500);
      }
      console.log("[finalize-signup] company_users already exists, continuing...");
    }

    // 5️⃣ Crear suscripción (se guarda como plan final; si venía de Free, queda Basic trialing)
    const providerSubscriptionId =
      intent.provider === "stripe" ? intent.stripe_subscription_id : intent.mp_preapproval_id;

    const providerCustomerId = intent.provider === "stripe" ? intent.stripe_customer_id : null;

    // Ensure required fields have valid values
    const subscriptionProvider = intent.provider || "stripe";
    const subscriptionAmountUsd = intent.amount_usd ?? 0; // Default to 0 for trial

    console.log("[finalize-signup] Upserting subscription", {
      provider: subscriptionProvider,
      amount_usd: subscriptionAmountUsd,
      companyId,
      finalPlanId,
    });

    const { data: existingSub, error: existingSubErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingSubErr) {
      console.error("[finalize-signup] Error checking existing subscription:", existingSubErr);
      return json({ error: String(existingSubErr.message ?? existingSubErr), step: "check_subscription" }, 500);
    }

    const subPayload = {
      company_id: companyId,
      plan_id: finalPlanId,
      provider: subscriptionProvider,
      provider_customer_id: providerCustomerId,
      provider_subscription_id: providerSubscriptionId,
      status: "trialing",
      trial_ends_at: trialEndsAt,
      current_period_end: trialEndsAt,
      amount_usd: subscriptionAmountUsd,
      amount_ars: intent.amount_ars ?? null,
      fx_rate_usd_ars: intent.fx_rate_usd_ars ?? null,
      fx_rate_at: intent.fx_rate_at ?? null,
      modules: intent.modules ?? [],
    };

    if (existingSub?.id) {
      const { error: updSubErr } = await supabaseAdmin
        .from("subscriptions")
        .update(subPayload)
        .eq("id", existingSub.id);
      if (updSubErr) {
        console.error("[finalize-signup] Error updating subscription:", updSubErr);
        return json({ error: String(updSubErr.message ?? updSubErr), step: "update_subscription" }, 500);
      }
    } else {
      const { error: subErr } = await supabaseAdmin.from("subscriptions").insert(subPayload);
      if (subErr) {
        console.error("[finalize-signup] Error creating subscription:", subErr);
        return json({ error: String(subErr.message ?? subErr), step: "create_subscription" }, 500);
      }
    }

    // 6️⃣ Guardar método de pago de signup (si existe) como método de la empresa
    console.log("[finalize-signup] Step 6: Looking for payment method for email:", intent.email);
    try {
      const { data: spm, error: spmErr } = await supabaseAdmin
        .from("signup_payment_methods")
        .select("id, provider, payment_method_ref, brand, last4, exp_month, exp_year, name")
        .eq("email", intent.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (spmErr) {
        console.log("[finalize-signup] No signup payment method found for email:", intent.email);
      } else if (spm) {
        console.log("[finalize-signup] Found signup payment method:", spm.id, "provider:", spm.provider);
        
        // Check if company has methods already
        const { data: existing } = await supabaseAdmin
          .from("company_payment_methods")
          .select("id")
          .eq("company_id", companyId);

        const isFirst = !existing || existing.length === 0;

        if (spm.provider === "stripe") {
          // Store card with metadata from signup
          const { error: insertErr } = await supabaseAdmin
            .from("company_payment_methods")
            .insert({
              company_id: companyId,
              type: "card",
              stripe_payment_method_id: spm.payment_method_ref,
              brand: spm.brand ?? null,
              last4: spm.last4 ?? null,
              exp_month: spm.exp_month ?? null,
              exp_year: spm.exp_year ?? null,
              holder_name: spm.name ?? null,
              is_default: isFirst,
            });
          
          if (insertErr) {
            console.error("[finalize-signup] Error inserting payment method:", insertErr);
            throw insertErr;
          }
          
          // Reflect in subscriptions for UI
          const { error: subErr } = await supabaseAdmin
            .from("subscriptions")
            .update({ stripe_payment_method_id: spm.payment_method_ref })
            .eq("company_id", companyId);
            
          if (subErr) {
            console.error("[finalize-signup] Error updating subscription:", subErr);
          }
        } else if (spm.provider === "mercadopago") {
          const { error: insertErr } = await supabaseAdmin
            .from("company_payment_methods")
            .insert({
              company_id: companyId,
              type: "mercadopago",
              mp_preapproval_id: spm.payment_method_ref,
              holder_name: spm.name ?? null,
              is_default: isFirst,
            });
          
          if (insertErr) {
            console.error("[finalize-signup] Error inserting MP payment method:", insertErr);
            throw insertErr;
          }
          
          const { error: subErr } = await supabaseAdmin
            .from("subscriptions")
            .update({ mp_preapproval_id: spm.payment_method_ref })
            .eq("company_id", companyId);
            
          if (subErr) {
            console.error("[finalize-signup] Error updating MP subscription:", subErr);
          }
        }

        // Link temp record to company - CRITICAL: mark as processed
        const { error: linkErr } = await supabaseAdmin
          .from("signup_payment_methods")
          .update({ linked_to_company_id: companyId })
          .eq("id", spm.id);
          
        if (linkErr) {
          console.error("[finalize-signup] CRITICAL: Failed to link signup payment method to company:", linkErr);
        } else {
          console.log("[finalize-signup] Successfully linked payment method", spm.id, "to company", companyId);
        }
      }
    } catch (e) {
      // Non-blocking: continue even if linking fails
      console.error("[finalize-signup] Payment method linking error:", e);
    }

    // Fallback: if no signup_payment_methods found, try linking from intent directly
    try {
      const { data: existing } = await supabaseAdmin
        .from("company_payment_methods")
        .select("id")
        .eq("company_id", companyId);

      const hasAnyMethod = !!existing && existing.length > 0;

      if (!hasAnyMethod) {
        if (intent.provider === "stripe" && intent.stripe_payment_method_id) {
          await supabaseAdmin
            .from("company_payment_methods")
            .insert({
              company_id: companyId,
              type: "card",
              stripe_payment_method_id: intent.stripe_payment_method_id,
              is_default: true,
            });
          await supabaseAdmin
            .from("subscriptions")
            .update({ stripe_payment_method_id: intent.stripe_payment_method_id })
            .eq("company_id", companyId);
        } else if (intent.provider === "mercadopago") {
          await supabaseAdmin
            .from("company_payment_methods")
            .insert({
              company_id: companyId,
              type: "mercadopago",
              mp_preapproval_id: intent.mp_preapproval_id ?? null,
              is_default: true,
            });
          await supabaseAdmin
            .from("subscriptions")
            .update({ mp_preapproval_id: intent.mp_preapproval_id ?? null })
            .eq("company_id", companyId);
        }
      }
    } catch (e) {
      console.warn("[finalize-signup] Fallback link failed:", e);
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

    if (updErr) return json({ error: String(updErr.message ?? updErr), step: "finalize_intent" }, 500);

    return json({ ok: true, redirect_to: "/auth" }, 200);
  } catch (e) {
    console.error("[finalize-signup] Unhandled error:", e);
    return json({ error: String(e), step: "unhandled" }, 500);
  }
});
