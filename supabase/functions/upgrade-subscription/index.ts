// supabase/functions/upgrade-subscription/index.ts
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

    const { company_id, new_plan_id } = await req.json();
    if (!company_id || !new_plan_id) {
      return json({ error: "company_id y new_plan_id son requeridos" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabaseUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(url, serviceRoleKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Validar acceso del usuario a la compañía
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);

    const { data: cu } = await supabaseAdmin
      .from("company_users")
      .select("id")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (!cu) return json({ error: "No tienes acceso a esta compañía" }, 403);

    // Obtener suscripción actual
    const { data: currentSub, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("*, subscription_plans(price, name, stripe_price_id)")
      .eq("company_id", company_id)
      .maybeSingle();

    if (subError || !currentSub) {
      return json({ error: "No se encontró suscripción activa" }, 404);
    }

    // Obtener nuevo plan
    const { data: newPlan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", new_plan_id)
      .single();

    if (planError || !newPlan) {
      return json({ error: "Plan no encontrado" }, 404);
    }

    const currentPrice = (currentSub.subscription_plans as any)?.price || 0;
    const newPrice = newPlan.price;
    const isUpgrade = newPrice > currentPrice;
    const isDifferent = newPrice !== currentPrice;

    // Si es el mismo plan, no hacer nada
    if (!isDifferent) {
      return json({ error: "El plan seleccionado es el actual" }, 400);
    }

    let result: any = {};

    // CASO 1: Stripe subscription
    if (currentSub.provider === "stripe" && currentSub.provider_subscription_id) {
      try {
        // Obtener suscripción actual en Stripe
        const stripeSub = await stripe.subscriptions.retrieve(currentSub.provider_subscription_id);

        if (isUpgrade) {
          // Upgrade: cambiar precio inmediatamente con proration
          const updatedSub = await stripe.subscriptions.update(
            currentSub.provider_subscription_id,
            {
              items: [
                {
                  id: stripeSub.items.data[0].id,
                  price: newPlan.stripe_price_id || undefined,
                  price_data: newPlan.stripe_price_id
                    ? undefined
                    : {
                        currency: "usd",
                        product_data: { name: newPlan.name },
                        unit_amount: Math.round(newPrice * 100),
                        recurring: { interval: "month" },
                      },
                }
              ],
              proration_behavior: "create_prorations",
            }
          );

          result.stripe_sub = updatedSub.id;
          result.new_status = updatedSub.status;
        } else {
          // Downgrade: cambiar en próximo período (no cobrar diferencia ahora)
          const updatedSub = await stripe.subscriptions.update(
            currentSub.provider_subscription_id,
            {
              items: [
                {
                  id: stripeSub.items.data[0].id,
                  price: newPlan.stripe_price_id || undefined,
                  price_data: newPlan.stripe_price_id
                    ? undefined
                    : {
                        currency: "usd",
                        product_data: { name: newPlan.name },
                        unit_amount: Math.round(newPrice * 100),
                        recurring: { interval: "month" },
                      },
                }
              ],
              proration_behavior: "always_invoice", // Crear invoice con crédito
            }
          );

          result.stripe_sub = updatedSub.id;
          result.new_status = updatedSub.status;
        }
      } catch (err: any) {
        console.error("[upgrade-subscription] Stripe error:", err);
        return json({ error: err.message || "Error al actualizar suscripción en Stripe" }, 500);
      }
    }

    // Actualizar en BD
    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_id: new_plan_id,
        status: result.new_status || currentSub.status,
      })
      .eq("company_id", company_id);

    if (updateError) {
      return json({ error: updateError.message || "Error al actualizar plan" }, 500);
    }

    // Registrar evento
    await supabaseAdmin.from("subscription_events").insert({
      company_id,
      event_type: isUpgrade ? "upgraded" : "downgraded",
      old_plan_id: currentSub.plan_id,
      new_plan_id,
      reason: `${isUpgrade ? "Upgrade" : "Downgrade"} de ${(currentSub.subscription_plans as any)?.name} a ${newPlan.name}`,
    });

    // Enviar email
    const { data: { user: userData } } = await supabaseUser.auth.getUser();
    if (userData?.email) {
      await supabaseAdmin.functions.invoke("send-alert-email", {
        body: {
          email: userData.email,
          subject: `Tu plan ha sido ${isUpgrade ? "actualizado" : "reducido"}`,
          message: `Tu suscripción cambió de ${(currentSub.subscription_plans as any)?.name} a ${newPlan.name}. Nuevo precio: $${newPrice} USD/mes.`,
        },
      }).catch(() => {});
    }

    return json({
      ok: true,
      message: `Plan ${isUpgrade ? "actualizado" : "reducido"} exitosamente`,
      old_plan: (currentSub.subscription_plans as any)?.name,
      new_plan: newPlan.name,
      old_price: currentPrice,
      new_price: newPrice,
      next_billing: stripeSub?.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
    });
  } catch (e) {
    console.error("[upgrade-subscription] Error:", e);
    return json({ error: String(e) }, 500);
  }
});
