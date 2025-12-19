// supabase/functions/mercadopago-webhook/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type MpTopic =
  | "subscription_preapproval"
  | "subscription_preapproval_plan"
  | "subscription_authorized_payment"
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

export default async (req: Request) => {
  // ✅ Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
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
      // notificación vacía o test
      return json({ ok: true, note: "No data.id" }, 200);
    }

    // Idempotencia
    const eventKey = `${topic}:${dataId}`;

    const { error: evtErr } = await supabaseAdmin
      .from("webhook_events")
      .insert({
        provider: "mercadopago",
        event_key: eventKey,
        payload: body ?? { query: Object.fromEntries(url.searchParams.entries()) },
      });

    if (evtErr) {
      // Duplicado → no reprocesar
      return json({ ok: true, note: "Duplicate" }, 200);
    }

    // 1) Consultar a MP el estado real del recurso
    const mpObj = await fetchMpResource(topic, dataId, mpToken);

    // 2) Encontrar intent_id (external_reference = intent.id)
    const externalRef: string | null =
      mpObj?.external_reference || mpObj?.metadata?.intent_id || null;

    // 3) Map status
    const mpStatus: string | null = mpObj?.status ?? null;
    const internalStatus = mapMpStatusToInternal(mpStatus);

    // 4) Caso A: flujo signup
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
        } else {
          await supabaseAdmin
            .from("signup_intents")
            .update({ status: "checkout_created" })
            .eq("id", intent.id);
        }

        return json({ ok: true }, 200);
      }
    }

    // 5) Caso B: suscripción ya existe
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

    return json({ ok: true }, 200);
  } catch (e) {
    // para debugging mejor 500. Cuando pases a prod, podés devolver 200 para evitar reintentos si ya guardás event_key.
    return json({ error: String(e) }, 500);
  }
};

