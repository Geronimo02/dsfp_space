// supabase/functions/create-intent/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
    },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getUsdToArsRate(): Promise<number> {
  const res = await fetchWithTimeout(
    "https://api.exchangerate.host/latest?base=USD&symbols=ARS&access_key=8af9f03e0afadcdfaa4b697cde3be02d",
    8000
  );
  if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
  const data = await res.json();
  const rate = data?.rates?.ARS;
  if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
    throw new Error("FX inválido (USD→ARS)");
  }
  return rate;
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
    const body = await req.json();
    const { email, full_name, company_name, plan_id, modules, provider } = body;

    if (!email || !plan_id || !provider) {
      return json({ error: "email, plan_id y provider son requeridos" }, 400);
    }

    const providerNorm = String(provider);
    if (!["stripe", "mercadopago"].includes(providerNorm)) {
      return json({ error: "provider inválido (stripe | mercadopago)" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) validar plan activo + obtener precio base (USD)
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, price, active")
      .eq("id", plan_id)
      .single();

    if (planErr || !plan || !plan.active) {
      return json({ error: "Plan inválido o inactivo" }, 400);
    }

    // 2) calcular total USD (server-side)
    const modulesArr: string[] = Array.isArray(modules) ? modules : [];
    const modulesPrice = modulesArr.length * 10; // TODO: pricing real
    const amount_usd = round2(Number(plan.price) + modulesPrice);

    if (!isFinite(amount_usd) || amount_usd <= 0) {
      return json({ error: "amount_usd inválido" }, 400);
    }

    // 3) FX solo para Mercado Pago
    let fx_rate_usd_ars: number | null = null;
    let fx_rate_at: string | null = null;
    let amount_ars: number | null = null;

    if (providerNorm === "mercadopago") {
      const fx = await getUsdToArsRate();
      fx_rate_usd_ars = fx;
      fx_rate_at = new Date().toISOString();
      amount_ars = round2(amount_usd * fx);

      if (!isFinite(amount_ars) || amount_ars <= 0) {
        return json({ error: "amount_ars inválido" }, 400);
      }
    }

    // 4) insertar intent
    const { data: intent, error: insErr } = await supabaseAdmin
      .from("signup_intents")
      .insert({
        email: String(email).trim().toLowerCase(),
        full_name: full_name ?? null,
        company_name: company_name ?? null,
        plan_id,
        modules: modulesArr,
        provider: providerNorm,
        status: "draft",
        amount_usd,
        amount_ars,
        fx_rate_usd_ars,
        fx_rate_at,
      })
      .select("id")
      .single();

    if (insErr) {
      return json({ error: String(insErr.message ?? insErr) }, 500);
    }

    return json({ intent_id: intent.id }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
};
