import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export default async (req: Request) => {
  try {
    const { intent_id, password } = await req.json();

    if (!intent_id || !password) {
      return Response.json(
        { error: "intent_id y password son requeridos" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1️⃣ Obtener signup_intent
    const { data: intent, error: intentErr } = await supabaseAdmin
      .from("signup_intents")
      .select("*")
      .eq("id", intent_id)
      .single();

    if (intentErr || !intent) {
      return Response.json(
        { error: "Signup intent no encontrado" },
        { status: 404 }
      );
    }

    if (intent.status !== "paid_ready") {
      return Response.json(
        { error: "El pago aún no fue confirmado" },
        { status: 409 }
      );
    }

    // 2️⃣ Crear usuario Auth (admin)
    const { data: createdUser, error: userErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: intent.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: intent.full_name ?? null,
        },
      });

    if (userErr || !createdUser?.user) {
      throw userErr ?? new Error("No se pudo crear el usuario");
    }

    const userId = createdUser.user.id;

    // 3️⃣ Crear empresa
    const { data: company, error: companyErr } = await supabaseAdmin
      .from("companies")
      .insert({
        name:
          intent.company_name ??
          intent.full_name ??
          "Nueva empresa",
        email: intent.email,
        active: true,
      })
      .select("id")
      .single();

    if (companyErr || !company) {
      throw companyErr ?? new Error("No se pudo crear la empresa");
    }

    const companyId = company.id;

    // ⚠️ A partir de acá se disparan automáticamente tus triggers:
    // - onboarding
    // - permisos
    // - módulos base
    // Todo OK.

    // 4️⃣ Asociar usuario a empresa como ADMIN (dueño)
    const { error: cuErr } = await supabaseAdmin
      .from("company_users")
      .insert({
        company_id: companyId,
        user_id: userId,
        role: "admin",
        active: true,
        platform_admin: false,
      });

    if (cuErr) throw cuErr;

    // 5️⃣ Crear suscripción (1 por empresa)
    const providerSubscriptionId =
      intent.provider === "stripe"
        ? intent.stripe_subscription_id
        : intent.mp_preapproval_id;

    const providerCustomerId =
      intent.provider === "stripe"
        ? intent.stripe_customer_id
        : null;

    const { error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        company_id: companyId,
        plan_id: intent.plan_id,
        provider: intent.provider,
        provider_customer_id: providerCustomerId,
        provider_subscription_id: providerSubscriptionId,
        status: "trialing",
        trial_ends_at: intent.trial_ends_at ?? null,
        current_period_end: intent.current_period_end ?? null,
        amount_usd: intent.amount_usd,
        amount_ars: intent.amount_ars ?? null,
        fx_rate_usd_ars: intent.fx_rate_usd_ars ?? null,
        fx_rate_at: intent.fx_rate_at ?? null,
        modules: intent.modules ?? [],
      });

    if (subErr) throw subErr;

    // 6️⃣ Marcar intent como completado
    const { error: updErr } = await supabaseAdmin
      .from("signup_intents")
      .update({ status: "completed" })
      .eq("id", intent_id);

    if (updErr) throw updErr;

    return Response.json({
      ok: true,
      redirect_to: "/auth",
    });
  } catch (e) {
    return Response.json(
      { error: String(e) },
      { status: 500 }
    );
  }
};
