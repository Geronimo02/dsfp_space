// supabase/functions/handle-stripe-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@15.0.0";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

async function handleInvoicePaymentFailed(event: any) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  console.log(`[stripe-webhook] Payment failed for subscription: ${subscriptionId}`);

  // Get subscription from DB
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("*, companies(email, name)")
    .eq("provider_subscription_id", subscriptionId)
    .single();

  if (!subscription) {
    console.error(`[stripe-webhook] Subscription not found: ${subscriptionId}`);
    return;
  }

  const company = subscription.companies as any;
  const retryCount = (subscription.payment_failed_count || 0) + 1;

  // Determinar próximo retry
  const retryDays = retryCount <= 2 ? 3 : retryCount <= 4 ? 7 : 14;
  const retryAfter = new Date(Date.now() + retryDays * 24 * 60 * 60 * 1000).toISOString();

  // Actualizar subscription
  const { error: updateErr } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "past_due",
      payment_failed_count: retryCount,
      last_payment_failed_at: new Date().toISOString(),
      payment_retry_after: retryAfter,
      // Si ya pasó 7 días, deshabilitar acceso
      disabled_until: retryCount >= 3 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
    })
    .eq("id", subscription.id);

  if (updateErr) {
    console.error("[stripe-webhook] Error updating subscription:", updateErr);
  }

  // Registrar evento
  await supabaseAdmin
    .from("subscription_events")
    .insert({
      company_id: subscription.company_id,
      event_type: "payment_failed",
      old_status: subscription.status,
      new_status: "past_due",
      reason: `Payment failed. Attempt #${retryCount}. Retrying on ${new Date(retryAfter).toDateString()}`,
      metadata: {
        invoice_id: invoice.id,
        failure_reason: invoice.last_payment_error?.message,
        retry_count: retryCount,
      },
    })
    .catch((e) => console.error("[stripe-webhook] Event log failed:", e));

  // Enviar email
  if (company?.email) {
    const subject =
      retryCount >= 3
        ? "⚠️ Acceso temporal deshabilitado - Pago pendiente"
        : `Pago rechazado - Reintentando el ${new Date(retryAfter).toDateString()}`;

    const message =
      retryCount >= 3
        ? `El pago ha fallado ${retryCount} veces. Acceso deshabilitado por 7 días. Por favor actualiza tu método de pago.`
        : `El pago fue rechazado. Reintentaremos automáticamente el ${new Date(retryAfter).toDateString()}.`;

    try {
      await supabaseAdmin.functions.invoke("send-alert-email", {
        body: {
          email: company.email,
          subject,
          message,
        },
      });
    } catch (e) {
      console.error("[stripe-webhook] Email send failed:", e);
    }
  }
}

async function handleInvoicePaymentSucceeded(event: any) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  console.log(`[stripe-webhook] Payment succeeded for subscription: ${subscriptionId}`);

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id, company_id, companies(email, name)")
    .eq("provider_subscription_id", subscriptionId)
    .single();

  if (!subscription) {
    console.error(`[stripe-webhook] Subscription not found: ${subscriptionId}`);
    return;
  }

  // Resetear contadores de fallo
  const { error: updateErr } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "active",
      payment_failed_count: 0,
      last_payment_failed_at: null,
      payment_retry_after: null,
      disabled_until: null,
    })
    .eq("id", subscription.id);

  if (updateErr) {
    console.error("[stripe-webhook] Error updating subscription:", updateErr);
  }

  // Registrar evento
  await supabaseAdmin
    .from("subscription_events")
    .insert({
      company_id: subscription.company_id,
      event_type: "payment_recovered",
      new_status: "active",
      reason: "Payment succeeded after previous failures",
      metadata: {
        invoice_id: invoice.id,
        amount: invoice.amount_paid,
      },
    })
    .catch((e) => console.error("[stripe-webhook] Event log failed:", e));

  // Enviar email
  const company = subscription.companies as any;
  if (company?.email) {
    try {
      await supabaseAdmin.functions.invoke("send-alert-email", {
        body: {
          email: company.email,
          subject: "✅ Pago exitoso - Suscripción activa",
          message: "Tu pago ha sido procesado exitosamente. Gracias por tu confianza.",
        },
      });
    } catch (e) {
      console.error("[stripe-webhook] Email send failed:", e);
    }
  }
}

async function handleSubscriptionDeleted(event: any) {
  const stripeSubscription = event.data.object;

  console.log(`[stripe-webhook] Subscription deleted in Stripe: ${stripeSubscription.id}`);

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id, company_id")
    .eq("provider_subscription_id", stripeSubscription.id)
    .single();

  if (!subscription) {
    console.error(`[stripe-webhook] Subscription not found: ${stripeSubscription.id}`);
    return;
  }

  // Cambiar a canceled
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("id", subscription.id);

  // Registrar evento
  await supabaseAdmin
    .from("subscription_events")
    .insert({
      company_id: subscription.company_id,
      event_type: "canceled",
      new_status: "canceled",
      reason: "Subscription deleted in Stripe",
    })
    .catch((e) => console.error("[stripe-webhook] Event log failed:", e));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (e) {
    console.error("[stripe-webhook] Signature verification failed:", e);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  console.log(`[stripe-webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;
      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (e) {
    console.error("[stripe-webhook] Error processing webhook:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
