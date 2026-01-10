// supabase/functions/cancel-subscription/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@15.0.0";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const { company_id, reason } = await req.json();
    if (!company_id) {
      return json({ error: "company_id es requerido" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabaseUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(url, serviceRoleKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Validar acceso
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);

    const { data: cu } = await supabaseAdmin
      .from("company_users")
      .select("id")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .eq("role", "admin") // Solo admins pueden cancelar
      .maybeSingle();

    if (!cu) return json({ error: "No tienes permiso para cancelar la suscripción" }, 403);

    // Obtener suscripción actual
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("*, companies(email, name)")
      .eq("company_id", company_id)
      .maybeSingle();

    if (subError || !subscription) {
      return json({ error: "No se encontró suscripción activa" }, 404);
    }

    const company = subscription.companies as any;

    // Cancelar en Stripe si existe
    if (subscription.provider === "stripe" && subscription.provider_subscription_id) {
      try {
        const stripeSub = await stripe.subscriptions.del(subscription.provider_subscription_id);
        console.log(`[cancel-subscription] Stripe subscription canceled: ${stripeSub.id}`);
      } catch (err: any) {
        console.error("[cancel-subscription] Stripe cancellation failed:", err);
        return json({ error: `Error al cancelar en Stripe: ${err.message}` }, 500);
      }
    }

    // Cambiar a canceled en BD
    const { error: updateErr } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancellation_reason: reason || "User requested cancellation",
      })
      .eq("company_id", company_id);

    if (updateErr) {
      return json({ error: updateErr.message || "Error al cancelar suscripción" }, 500);
    }

    // Registrar evento
    await supabaseAdmin
      .from("subscription_events")
      .insert({
        company_id,
        event_type: "canceled",
        old_plan_id: subscription.plan_id,
        old_status: subscription.status,
        new_status: "canceled",
        reason: reason || "User requested cancellation",
      })
      .catch((e) => console.error("[cancel-subscription] Event log failed:", e));

    // Enviar email de confirmación
    if (company?.email) {
      try {
        await supabaseAdmin.functions.invoke("send-alert-email", {
          body: {
            email: company.email,
            subject: "Suscripción cancelada",
            message: `Tu suscripción ha sido cancelada exitosamente. Si cambias de idea, puedes reactivarla en cualquier momento.`,
          },
        });
      } catch (e) {
        console.error("[cancel-subscription] Email send failed:", e);
      }
    }

    return json({
      ok: true,
      message: "Suscripción cancelada exitosamente",
      canceled_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cancel-subscription] Error:", e);
    return json({ error: String(e) }, 500);
  }
});
