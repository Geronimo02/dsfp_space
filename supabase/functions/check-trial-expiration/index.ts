// supabase/functions/check-trial-expiration/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req: Request) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    console.log("[check-trial-expiration] Checking trials expiring between now and 7 days...");

    // 1️⃣ Trials expiring in 7 días: enviar alerta
    const { data: expiringTrials } = await supabaseAdmin
      .from("subscriptions")
      .select("id, company_id, trial_ends_at, subscription_plans(name)")
      .eq("status", "trialing")
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", sevenDaysFromNow.toISOString());

    if (expiringTrials && expiringTrials.length > 0) {
      console.log(`[check-trial-expiration] Found ${expiringTrials.length} trials expiring soon`);

      for (const sub of expiringTrials) {
        const daysLeft = Math.ceil(
          (new Date(sub.trial_ends_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Get company email
        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("email, name")
          .eq("id", sub.company_id)
          .single();

        if (company?.email) {
          // Send email notification
          try {
            await supabaseAdmin.functions.invoke("send-alert-email", {
              body: {
                email: company.email,
                subject: `Tu período de prueba termina en ${daysLeft} días`,
                message: `Hola ${company.name},\n\nTu período de prueba del plan ${(sub.subscription_plans as any)?.name} expira en ${daysLeft} días.\n\nAgrega un método de pago para continuar usando nuestros servicios sin interrupciones.\n\nSi tienes preguntas, contáctanos en support@app.com`,
              },
            }).catch((e) => console.error("[check-trial-expiration] Email send failed:", e));
          } catch (e) {
            console.error("[check-trial-expiration] Error sending email:", e);
          }
        }
      }
    }

    // 2️⃣ Trials ya expirados: cambiar a free plan o deshabilitar
    const { data: expiredTrials } = await supabaseAdmin
      .from("subscriptions")
      .select("id, company_id, trial_ends_at, provider_subscription_id")
      .eq("status", "trialing")
      .lt("trial_ends_at", now.toISOString());

    if (expiredTrials && expiredTrials.length > 0) {
      console.log(`[check-trial-expiration] Found ${expiredTrials.length} expired trials`);

      for (const sub of expiredTrials) {
        // Cambiar status a inactive (sin plan activo)
        const { error: updateErr } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            disabled_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Disabled for 30 days
          })
          .eq("id", sub.id);

        if (updateErr) {
          console.error("[check-trial-expiration] Error updating subscription:", updateErr);
        } else {
          console.log(`[check-trial-expiration] ✅ Trial expired, marked as canceled: ${sub.id}`);

          // Log event
          await supabaseAdmin.from("subscription_events").insert({
            company_id: sub.company_id,
            event_type: "trial_expired",
            old_status: "trialing",
            new_status: "canceled",
            reason: "Trial period expired without payment method",
          }).catch((e) => console.error("[check-trial-expiration] Event log failed:", e));
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, checked_at: now.toISOString() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[check-trial-expiration] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
