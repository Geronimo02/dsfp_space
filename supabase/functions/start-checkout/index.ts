import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

type Provider = "stripe" | "mercadopago";

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { intent_id, success_url, cancel_url } = await req.json();

    if (!intent_id || !success_url || !cancel_url) {
      return Response.json(
        { error: "intent_id, success_url y cancel_url son requeridos" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Cargar intent
    const { data: intent, error: intentErr } = await supabaseAdmin
      .from("signup_intents")
      .select("*")
      .eq("id", intent_id)
      .single();

    if (intentErr || !intent) {
      return Response.json({ error: "Signup intent no encontrado" }, { status: 404 });
    }

    const provider: Provider = intent.provider;

    if (!["draft", "checkout_created"].includes(intent.status)) {
      return Response.json(
        { error: "El intent no está en un estado válido" },
        { status: 409 }
      );
    }

    // 2) Branch por provider
    if (provider === "stripe") {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        apiVersion: "2023-10-16",
      });

      // Customer
      const customer = await stripe.customers.create({
        email: intent.email,
        name: intent.full_name ?? undefined,
        metadata: { intent_id: intent.id },
      });

      // Checkout Session (subscription + trial)
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.id,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: Math.round(Number(intent.amount_usd) * 100),
              recurring: { interval: "month" },
              product_data: {
                name: "Suscripción mensual",
                description: `Plan ${intent.plan_id}`,
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 7,
          metadata: { intent_id: intent.id },
        },
        success_url,
        cancel_url,
        metadata: { intent_id: intent.id },
      });

      // Persistir
      const { error: updErr } = await supabaseAdmin
        .from("signup_intents")
        .update({
          status: "checkout_created",
          stripe_customer_id: customer.id,
          stripe_checkout_session_id: session.id,
        })
        .eq("id", intent_id);

      if (updErr) throw updErr;

      return Response.json({ checkout_url: session.url, provider: "stripe" });
    }

    if (provider === "mercadopago") {
      const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
      if (!mpToken) {
        return Response.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 });
      }

      // Validar monto ARS (Mercado Pago AR normalmente opera en ARS)
      if (!intent.amount_ars) {
        return Response.json(
          { error: "intent.amount_ars es requerido para Mercado Pago" },
          { status: 400 }
        );
      }

      // 2.1) Crear preapproval_plan (plan de suscripción)
      // Nota: MP requiere frecuencia y monto; esto crea “el plan” que después el pagador acepta.
      const planPayload = {
        reason: `Suscripción ${intent.plan_id}`,
        external_reference: intent.id, // clave para relacionar
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: Number(intent.amount_ars),
          currency_id: "ARS",
          // free_trial: { frequency: 7, frequency_type: "days" } // MP soporta trial en planes
          free_trial: { frequency: 7, frequency_type: "days" },
        },
        back_url: success_url,
      };

      const planRes = await fetch("https://api.mercadopago.com/preapproval_plan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(planPayload),
      });

      if (!planRes.ok) {
        const errTxt = await planRes.text();
        return Response.json({ error: `MP plan error: ${errTxt}` }, { status: 502 });
      }

      const mpPlan = await planRes.json();

      // 2.2) Crear preapproval (link de checkout para que el usuario autorice la suscripción)
      const preapprovalPayload = {
        preapproval_plan_id: mpPlan.id,
        reason: planPayload.reason,
        external_reference: intent.id,
        payer_email: intent.email,
        back_url: success_url,
      };

      const preRes = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preapprovalPayload),
      });

      if (!preRes.ok) {
        const errTxt = await preRes.text();
        return Response.json({ error: `MP preapproval error: ${errTxt}` }, { status: 502 });
      }

      const mpPre = await preRes.json();

      // init_point suele venir como URL de aprobación
      const checkoutUrl = mpPre.init_point || mpPre.sandbox_init_point;
      if (!checkoutUrl) {
        return Response.json(
          { error: "MP no devolvió init_point/sandbox_init_point" },
          { status: 502 }
        );
      }

      // Persistir IDs MP en intent
      const { error: updErr } = await supabaseAdmin
        .from("signup_intents")
        .update({
          status: "checkout_created",
          mp_preapproval_plan_id: mpPlan.id,
          mp_preapproval_id: mpPre.id,
        })
        .eq("id", intent_id);

      if (updErr) throw updErr;

      return Response.json({ checkout_url: checkoutUrl, provider: "mercadopago" });
    }

    return Response.json({ error: "Provider inválido" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
};
