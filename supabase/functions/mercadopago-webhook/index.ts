// supabase/functions/mercadopago-webhook/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type MpTopic =
  | "subscription_preapproval"
  | "subscription_preapproval_plan"
  | "subscription_authorized_payment"
  | "payment"
  | string;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapMpStatusToInternal(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (["authorized", "approved", "active"].includes(s)) return "active";
  if (["paused"].includes(s)) return "past_due";
  if (["cancelled", "canceled"].includes(s)) return "canceled";
  if (["pending"].includes(s)) return "incomplete";
  return "incomplete";
}

async function fetchMpResource(topic: MpTopic, id: string, token: string) {
  let url = "";

  if (topic === "subscription_preapproval") {
    url = `https://api.mercadopago.com/preapproval/${id}`;
  } else if (topic === "subscription_preapproval_plan") {
    url = `https://api.mercadopago.com/preapproval_plan/${id}`;
  } else if (topic === "subscription_authorized_payment") {
    url = `https://api.mercadopago.com/authorized_payments/${id}`;
  } else if (topic === "payment") {
    url = `https://api.mercadopago.com/v1/payments/${id}`;
  } else {
    url = `https://api.mercadopago.com/preapproval/${id}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MP fetch error (${topic} ${id}): ${txt}`);
  }

  return await res.json();
}

// Obtener detalles del pago para extraer info de tarjeta
async function fetchPaymentDetails(paymentId: string, token: string) {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Extraer y guardar datos de tarjeta del pago
async function saveCardDetailsFromPayment(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  paymentData: any,
  preapprovalId: string
) {
  const card = paymentData?.card;
  if (!card) return;

  const last4 = card.last_four_digits;
  const expMonth = card.expiration_month;
  const expYear = card.expiration_year;
  const holderName = card.cardholder?.name;
  const brand = paymentData.payment_method_id; // visa, master, amex, etc.

  if (!last4) return;

  // Actualizar el método de pago existente o crear uno nuevo
  const { data: existing } = await supabase
    .from("company_payment_methods")
    .select("id")
    .eq("company_id", companyId)
    .eq("mp_preapproval_id", preapprovalId)
    .maybeSingle();

  if (existing) {
    // Actualizar con los datos de la tarjeta
    await supabase
      .from("company_payment_methods")
      .update({
        last4,
        exp_month: expMonth,
        exp_year: expYear,
        holder_name: holderName,
        brand,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    
    console.log("Card details updated for existing payment method");
  } else {
    // Verificar si es el primer método de pago
    const { data: allMethods } = await supabase
      .from("company_payment_methods")
      .select("id")
      .eq("company_id", companyId);

    const isFirst = !allMethods || allMethods.length === 0;

    await supabase.from("company_payment_methods").insert({
      company_id: companyId,
      type: "mercadopago",
      mp_preapproval_id: preapprovalId,
      last4,
      exp_month: expMonth,
      exp_year: expYear,
      holder_name: holderName,
      brand,
      is_default: isFirst,
    });
    
    console.log("New payment method created with card details");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Acknowledge GET quickly (useful for testing)
  if (req.method === "GET") {
    return json({ ok: true }, 200);
  }

  try {
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpToken) {
      return json({ error: "MP_ACCESS_TOKEN missing" }, 500);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const url = new URL(req.url);

    const topic: MpTopic =
      body?.type ||
      body?.topic ||
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      "subscription_preapproval";

    const dataId: string | null =
      body?.data?.id ||
      body?.id ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id");

    if (!dataId) {
      return json({ ok: true, note: "No data.id" }, 200);
    }

    const eventKey = `${topic}:${dataId}`;

    const { error: evtErr } = await supabaseAdmin
      .from("webhook_events")
      .insert({
        provider: "mercadopago",
        event_key: eventKey,
        payload: body ?? { query: Object.fromEntries(url.searchParams.entries()) },
      });

    if (evtErr) {
      return json({ ok: true, note: "Duplicate" }, 200);
    }

    const mpObj = await fetchMpResource(topic, dataId, mpToken);

    const externalRef: string | null =
      mpObj?.external_reference || mpObj?.metadata?.intent_id || null;

    const mpStatus: string | null = mpObj?.status ?? null;
    const internalStatus = mapMpStatusToInternal(mpStatus);

    console.log("MP topic:", topic);
    console.log("MP status:", mpStatus);
    console.log("External reference:", externalRef);

    // --- Manejar eventos de pago para capturar datos de tarjeta ---
    if (topic === "payment" || topic === "subscription_authorized_payment") {
      let paymentData = mpObj;
      
      // Si es authorized_payment, necesitamos obtener el payment_id
      if (topic === "subscription_authorized_payment" && mpObj?.payment?.id) {
        paymentData = await fetchPaymentDetails(mpObj.payment.id, mpToken);
      }

      if (paymentData?.card) {
        // Buscar la suscripción asociada
        const preapprovalId = mpObj?.preapproval_id || paymentData?.metadata?.preapproval_id;
        
        if (preapprovalId) {
          const { data: sub } = await supabaseAdmin
            .from("subscriptions")
            .select("id, company_id, mp_preapproval_id")
            .or(`mp_preapproval_id.eq.${preapprovalId},provider_subscription_id.eq.${preapprovalId}`)
            .maybeSingle();

          if (sub?.company_id) {
            await saveCardDetailsFromPayment(
              supabaseAdmin,
              sub.company_id,
              paymentData,
              preapprovalId
            );
            console.log("Card details saved for company:", sub.company_id);
          }
        }
      }
    }

    if (externalRef) {
      const { data: intent, error: intentErr } = await supabaseAdmin
        .from("signup_intents")
        .select("id, status, mp_preapproval_id")
        .eq("id", externalRef)
        .maybeSingle();

      if (!intentErr && intent) {
        if (internalStatus === "active") {
          const { error: updIntentErr } = await supabaseAdmin
            .from("signup_intents")
            .update({
              status: "paid_ready",
              mp_preapproval_id: intent.mp_preapproval_id ?? mpObj?.id ?? dataId,
            })
            .eq("id", intent.id);

          if (updIntentErr) throw updIntentErr;
        } else if (internalStatus === "canceled") {
          await supabaseAdmin.from("signup_intents").update({ status: "canceled" }).eq("id", intent.id);
        } else {
          await supabaseAdmin.from("signup_intents").update({ status: "checkout_created" }).eq("id", intent.id);
        }

        return json({ ok: true }, 200);
      }
    }

    const providerSubId = mpObj?.id ?? dataId;

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status, company_id, mp_preapproval_id")
      .eq("provider", "mercadopago")
      .eq("provider_subscription_id", providerSubId)
      .maybeSingle();

    if (!subErr && sub) {
      const { error: updSubErr } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status: internalStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (updSubErr) throw updSubErr;

      // When authorized/active, reflect as a saved method for the company
      if (internalStatus === "active" && sub.company_id) {
        const { data: existing } = await supabaseAdmin
          .from("company_payment_methods")
          .select("id")
          .eq("company_id", sub.company_id)
          .eq("mp_preapproval_id", sub.mp_preapproval_id ?? providerSubId)
          .maybeSingle();

        if (!existing) {
          const { data: allMethods } = await supabaseAdmin
            .from("company_payment_methods")
            .select("id")
            .eq("company_id", sub.company_id);

          const isFirst = !allMethods || allMethods.length === 0;

          await supabaseAdmin
            .from("company_payment_methods")
            .insert({
              company_id: sub.company_id,
              type: "mercadopago",
              mp_preapproval_id: sub.mp_preapproval_id ?? providerSubId,
              is_default: isFirst,
            });
        }
      }
    }

    return json({ ok: true }, 200);
  } catch (e) {
    console.error("Webhook error:", e);
    return json({ error: String(e) }, 500);
  }
});
