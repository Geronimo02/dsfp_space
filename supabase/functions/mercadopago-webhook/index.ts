import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MpTopic =
  | "subscription_preapproval"
  | "subscription_preapproval_plan"
  | "subscription_authorized_payment"
  | string;

function mapMpStatusToInternal(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();

  // MP suele usar: authorized/approved/active/paused/cancelled/pending
  if (["authorized", "approved", "active"].includes(s)) return "active";
  if (["paused"].includes(s)) return "past_due";
  if (["cancelled", "canceled"].includes(s)) return "canceled";
  if (["pending"].includes(s)) return "incomplete";

  // fallback seguro
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
  } else {
    // fallback: intentamos preapproval por defecto
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

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpToken) {
      return new Response("MP_ACCESS_TOKEN missing", { status: 500 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // MP puede mandar datos en body JSON o query params.
    // Ejemplos comunes:
    // - body: { "type": "...", "data": { "id": "123" } }
    // - query: ?topic=subscription_preapproval&id=123
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
      // MP a veces manda notificaciones “vacías” o de prueba
      return new Response("No data.id", { status: 200 });
    }

    // Idempotencia (recomendado)
    const eventKey = `${topic}:${dataId}`;

    // Insert idempotente (si ya existe, no procesamos)
    const { error: evtErr } = await supabaseAdmin
      .from("webhook_events")
      .insert({
        provider: "mercadopago",
        event_key: eventKey,
        payload: body ?? { query: Object.fromEntries(url.searchParams.entries()) },
      });

    if (evtErr) {
      // si es duplicado por unique constraint, devolvemos 200
      // (en Postgres el error exacto puede variar; igual, mejor no re-procesar)
      return new Response("Duplicate", { status: 200 });
    }

    // 1) Consultar a MP el estado real del recurso
    const mpObj = await fetchMpResource(topic, dataId, mpToken);

    // 2) Encontrar intent_id (lo guardamos como external_reference = intent.id)
    const externalRef: string | null =
      mpObj?.external_reference ||
      mpObj?.metadata?.intent_id ||
      null;

    // 3) Si es preapproval, trae status de suscripción
    const mpStatus: string | null = mpObj?.status ?? null;
    const internalStatus = mapMpStatusToInternal(mpStatus);

    // 4) Caso A: todavía estás en flujo de signup (intent existe y debe pasar a paid_ready)
    if (externalRef) {
      const { data: intent, error: intentErr } = await supabaseAdmin
        .from("signup_intents")
        .select("id, status, mp_preapproval_id")
        .eq("id", externalRef)
        .maybeSingle();

      if (!intentErr && intent) {
        // Para habilitar registro, exigimos que MP esté "authorized/approved/active"
        if (["active"].includes(internalStatus)) {
          const { error: updIntentErr } = await supabaseAdmin
            .from("signup_intents")
            .update({
              status: "paid_ready",
              mp_preapproval_id: intent.mp_preapproval_id ?? mpObj?.id ?? dataId,
            })
            .eq("id", intent.id);

          if (updIntentErr) throw updIntentErr;
        } else {
          // si no está activo, lo dejamos en checkout_created (o failed si querés)
          await supabaseAdmin
            .from("signup_intents")
            .update({ status: "checkout_created" })
            .eq("id", intent.id);
        }

        return new Response("OK", { status: 200 });
      }
    }

    // 5) Caso B: suscripción ya existe (empresa ya creada)
    // actualizamos subscriptions por provider_subscription_id = preapproval.id
    const providerSubId = mpObj?.id ?? dataId;

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status")
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
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    // Importante: responder 200 solo si querés evitar reintentos. Para debugging, 500 está bien.
    return new Response(`Error: ${String(e)}`, { status: 500 });
  }
};
